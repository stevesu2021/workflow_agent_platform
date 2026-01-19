"""
Service for decomposing agent requirements into detailed implementation plan.
Uses thinking LLM to analyze requirements and generate comprehensive breakdown.
"""
import json
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.models.ai_resource import AiResource
from app.models.tool import Tool
from app.models.knowledge import KnowledgeBase, Document
from app.services.ai_resource_service import AiResourceService
from app.core.database import async_session_factory
from app.services.vector_service import kb_id_to_collection_name


class RequirementDecompositionService:
    """Service for analyzing and decomposing agent requirements."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.ai_resource_service = AiResourceService(session)

    async def get_llm_config(self, model_identifier: str) -> Optional[Dict[str, Any]]:
        """
        Get LLM configuration by resource ID or name.

        Args:
            model_identifier: Resource ID (UUID) or resource name

        Returns:
            Dict with api_key, base_url, and model name, or None if not found
        """
        import uuid

        resource = None

        # First, try to parse as UUID and search by ID
        try:
            resource_id = uuid.UUID(model_identifier)
            resource = await self.ai_resource_service.get_resource(resource_id)
            if resource and resource.type != "text_llm":
                resource = None
        except (ValueError, AttributeError):
            # Not a valid UUID, continue to name search
            pass

        # Fallback: search by name if not found by ID
        if not resource:
            resource = await self.ai_resource_service.get_resource_by_name(
                model_identifier, type_filter="text_llm"
            )

        if resource:
            # Extract model name from resource config
            actual_model = resource.config.get("model") if resource.config else None
            if not actual_model:
                actual_model = resource.name

            return {
                "api_key": resource.api_key,
                "base_url": resource.endpoint,
                "model": actual_model,
                "resource_name": resource.name
            }

        return None

    async def get_knowledge_base_info(self, kb_id: str) -> Dict[str, Any]:
        """Get detailed information about a knowledge base."""
        try:
            import uuid
            kb_uuid = uuid.UUID(kb_id)
            kb = await self.session.get(KnowledgeBase, kb_uuid)
            if kb:
                return {
                    "id": str(kb.id),
                    "name": kb.name,
                    "description": kb.description,
                    "type": kb.type,
                    "collection_name": kb_id_to_collection_name(kb_id)
                }
        except Exception as e:
            print(f"Error getting KB info for {kb_id}: {e}")
        return {}

    async def get_document_info(self, kb_id: str) -> List[Dict[str, Any]]:
        """Get information about documents in a knowledge base."""
        try:
            import uuid
            kb_uuid = uuid.UUID(kb_id)
            stmt = select(Document).where(Document.kb_id == kb_uuid)
            result = await self.session.execute(stmt)
            documents = result.scalars().all()

            doc_info = []
            for doc in documents:
                doc_data = {
                    "filename": doc.filename,
                    "file_type": doc.file_type,
                    "status": doc.status,
                    "chunk_count": doc.chunk_count if doc.chunk_count else 0
                }
                # Add extra metadata
                if doc.extra_metadata:
                    if doc.file_type in ['xlsx', 'xls'] and doc.extra_metadata.get('excel_columns'):
                        doc_data["indexed_columns"] = doc.extra_metadata.get('excel_columns', [])
                    if doc.extra_metadata.get('row_count'):
                        doc_data["row_count"] = doc.extra_metadata.get('row_count')
                doc_info.append(doc_data)
            return doc_info
        except Exception as e:
            print(f"Error getting document info for KB {kb_id}: {e}")
        return []

    async def get_tool_info(self, tool_name: str) -> Dict[str, Any]:
        """Get information about a tool."""
        try:
            stmt = select(Tool).where(Tool.name == tool_name)
            result = await self.session.execute(stmt)
            tool = result.scalars().first()
            if tool:
                return {
                    "name": tool.name,
                    "description": tool.description,
                    "type": tool.type,
                    "config": tool.config
                }
        except Exception as e:
            print(f"Error getting tool info for {tool_name}: {e}")
        return {}

    async def analyze_resource_files(self, resource_files: List[Dict[str, Any]], kb_id: Optional[str]) -> str:
        """Analyze resource files and generate description."""
        if not resource_files:
            return "无资源附件"

        analysis_parts = ["### 资源文件分析\n"]
        analysis_parts.append(f"共上传 {len(resource_files)} 个资源文件：\n")

        for i, file_info in enumerate(resource_files, 1):
            analysis_parts.append(f"{i}. **{file_info.get('name')}** ({file_info.get('status', 'unknown')})")

        # If there's a knowledge base with these files, get more details
        if kb_id:
            doc_info = await self.get_document_info(kb_id)
            if doc_info:
                analysis_parts.append("\n**文件详情：**\n")
                for doc in doc_info:
                    analysis_parts.append(f"- `{doc['filename']}`")
                    analysis_parts.append(f"  - 类型: {doc['file_type']}")
                    analysis_parts.append(f"  - 状态: {doc['status']}")
                    if doc.get('chunk_count'):
                        analysis_parts.append(f"  - 分块数量: {doc['chunk_count']}")
                    if doc.get('indexed_columns'):
                        analysis_parts.append(f"  - 索引列: {', '.join(doc['indexed_columns'])}")
                    if doc.get('row_count'):
                        analysis_parts.append(f"  - 行数: {doc['row_count']}")
                    analysis_parts.append("")

        return "\n".join(analysis_parts)

    def build_decomposition_prompt(
        self,
        agent_data: Dict[str, Any],
        config: Dict[str, Any],
        resource_analysis: str,
        kb_info: List[Dict[str, Any]],
        tool_info: List[Dict[str, Any]],
        mcp_info: List[Dict[str, Any]]
    ) -> tuple[str, str]:
        """
        Build the system prompt and user prompt for requirement decomposition.
        Returns (system_prompt, user_prompt).
        """

        system_prompt = """你是一位资深的AI智能体架构专家，精通LangGraph框架设计和多智能体系统开发。

你的任务是仔细阅读用户提供的智能体需求文档，进行深度分析和需求拆解，输出一份**完整、详细、可执行**的需求拆解文档。

## 输出文档要求

你的输出必须是一份结构化的Markdown文档，包含以下章节：

### 1. 需求理解与目标分析
- 核心目标：智能体要解决什么问题？
- 输入分析：用户需要提供什么？
- 输出定义：智能体最终要产出什么？
- 关键挑战：实现过程中可能遇到的难点

### 2. 资源文件深度分析
{resource_analysis_section}
- 文件内容理解：每个文件包含什么信息？
- 数据结构分析：Excel/PDF等文件的字段、表格结构
- 信息提取策略：如何从这些文件中获取所需信息？
- 知识库构建建议：如何向量化存储这些资源？

### 3. 技术架构设计 (LangGraph)
- **整体架构图**：描述智能体的工作流程
- **节点设计**：
  - 每个节点的功能定义
  - 节点之间的数据流转
  - 条件分支逻辑
- **状态管理**：AgentState的字段定义
- **控制流**：串行/并行/循环等执行模式

### 4. 大模型配置方案
**思考模型**：
- 模型名称：{thinking_model}
- API地址：{thinking_endpoint}
- 用途：复杂推理、任务规划、决策分析

**总结模型**：
- 模型名称：{summary_model}
- API地址：{summary_endpoint}
- 用途：信息提取、结果汇总、格式化输出

**调用方式**：
```python
# ChatOpenAI 配置示例
llm = ChatOpenAI(
    model="{actual_model}",
    openai_api_key="your_api_key",
    openai_api_base="{base_url}",
    temperature=0.7
)
```

### 5. 知识库配置
{kb_info_section}

### 6. 工具与服务配置
{tool_info_section}

### 7. 任务拆解与执行步骤
将任务拆解为清晰的执行步骤，每步包含：
- **步骤编号与名称**
- **功能描述**：这一步要做什么
- **输入数据**：需要什么数据
- **处理逻辑**：具体实现思路
- **输出数据**：产出什么
- **使用组件**：LLM/知识库/工具/MCP
- **提示词模板**：关键提示词

### 8. 输出格式定义
详细定义智能体的最终输出格式：
- **输出类型**：文本/JSON/文件
- **字段说明**：每个字段的含义
- **示例输出**：给出完整的输出示例

### 9. 边界条件与异常处理
- 输入验证规则
- 异常场景处理
- 降级策略

### 10. 实施建议
- 开发优先级
- 测试要点
- 优化方向

---

## 重要提示

1. **基于LangGraph**：所有架构设计必须基于LangGraph框架
2. **充分理解资源**：仔细分析资源文件的内容和结构
3. **明确调用方式**：详细说明每个API/服务的调用方法
4. **可执行性**：输出的文档应该能让开发者直接根据文档实现
5. **完整性**：不要遗漏任何重要的技术细节

现在，请基于以下信息，生成详细的需求拆解文档：
"""

        # Build user prompt with actual data
        user_prompt = f"""# 智能体需求文档

## 基本信息
- **名称**：{agent_data.get('name', '未命名')}
- **描述**：{agent_data.get('description', '无描述')}
- **类型**：Agentic 智能体

## 任务描述
{config.get('task_description', '无详细任务描述')}

## 系统提示词
```
{config.get('prologue', '无')}
```

## 专业词汇
{', '.join(config.get('vocabulary', [])) if config.get('vocabulary') else '无'}

## 输入输出配置
**输入参数**：
{self._format_io_config(config.get('io_config', {}).get('inputs', []))}

**输出参数**：
{self._format_io_config(config.get('io_config', {}).get('outputs', []))}

## 配置参数
- **最大思考次数**：{config.get('max_thoughts', 5)}

## 资源文件分析
{resource_analysis}

## 知识库信息
{self._format_kb_info(kb_info)}

## 工具列表
{self._format_tool_info(tool_info)}

## MCP服务
{self._format_mcp_info(mcp_info)}

---

请根据以上信息，输出完整的需求拆解文档。
"""

        return system_prompt, user_prompt

    def _format_io_config(self, io_fields: List[Dict[str, Any]]) -> str:
        if not io_fields:
            return "无"
        lines = []
        for field in io_fields:
            lines.append(f"- **{field.get('label')}** ({field.get('name')})")
            lines.append(f"  - 类型: {field.get('type')}")
            lines.append(f"  - 必填: {'是' if field.get('required') else '否'}")
            if field.get('placeholder'):
                lines.append(f"  - 占位符: {field.get('placeholder')}")
            if field.get('options'):
                lines.append(f"  - 选项: {', '.join(field.get('options', []))}")
        return "\n".join(lines)

    def _format_kb_info(self, kb_list: List[Dict[str, Any]]) -> str:
        if not kb_list:
            return "无关联知识库"
        lines = []
        for kb in kb_list:
            lines.append(f"- **{kb.get('name')}**")
            lines.append(f"  - 类型: {kb.get('type')}")
            lines.append(f"  - Collection: {kb.get('collection_name')}")
            if kb.get('description'):
                lines.append(f"  - 描述: {kb.get('description')}")
        return "\n".join(lines)

    def _format_tool_info(self, tool_list: List[Dict[str, Any]]) -> str:
        if not tool_list:
            return "无关联工具"
        lines = []
        for tool in tool_list:
            lines.append(f"- **{tool.get('name')}**")
            lines.append(f"  - 类型: {tool.get('type')}")
            if tool.get('description'):
                lines.append(f"  - 描述: {tool.get('description')}")
        return "\n".join(lines)

    def _format_mcp_info(self, mcp_list: List[Dict[str, Any]]) -> str:
        if not mcp_list:
            return "无关联MCP服务"
        lines = []
        for mcp in mcp_list:
            lines.append(f"- **{mcp.get('name')}**")
            if mcp.get('description'):
                lines.append(f"  - 描述: {mcp.get('description')}")
        return "\n".join(lines)

    async def decompose_requirements(
        self,
        agent_data: Dict[str, Any],
        config: Dict[str, Any]
    ) -> str:
        """
        Decompose agent requirements into detailed implementation plan.

        Args:
            agent_data: Agent basic information
            config: Agent configuration including model choices, tools, KBs, etc.

        Returns:
            Detailed requirement decomposition document in Markdown format
        """
        thinking_model = config.get('model_thinking', 'qwen3')
        summary_model = config.get('model_summary', 'mimo-v2-flash')

        # Get LLM configurations
        thinking_config = await self.get_llm_config(thinking_model)
        summary_config = await self.get_llm_config(summary_model)

        # Get knowledge base information
        kb_ids = config.get('knowledge_bases', [])
        kb_info_list = []
        for kb_id in kb_ids:
            kb_info = await self.get_knowledge_base_info(kb_id)
            if kb_info:
                kb_info_list.append(kb_info)

        # Get tool information
        tool_names = config.get('tools', [])
        tool_info_list = []
        for tool_name in tool_names:
            tool_info = await self.get_tool_info(tool_name)
            if tool_info:
                tool_info_list.append(tool_info)

        # Get resource KB ID and analyze resource files
        resource_kb_id = None
        resource_files = config.get('resource_files', [])
        # Try to find the resource KB (not in the main knowledge_bases list)
        # This would be the KB created specifically for resource files
        for kb_id in kb_ids:
            kb_info = await self.get_knowledge_base_info(kb_id)
            if kb_info and 'resource' in kb_info.get('name', '').lower():
                resource_kb_id = kb_id
                break

        resource_analysis = await self.analyze_resource_files(
            resource_files,
            resource_kb_id
        )

        # Build prompts
        system_prompt, user_prompt = self.build_decomposition_prompt(
            agent_data=agent_data,
            config=config,
            resource_analysis=resource_analysis,
            kb_info=kb_info_list,
            tool_info=tool_info_list,
            mcp_info=[]  # MCP info to be implemented
        )

        # Add model endpoint info to system prompt
        system_prompt = system_prompt.format(
            resource_analysis_section=resource_analysis,
            thinking_model=thinking_model,
            thinking_endpoint=thinking_config.get('base_url', 'N/A') if thinking_config else 'N/A',
            summary_model=summary_model,
            summary_endpoint=summary_config.get('base_url', 'N/A') if summary_config else 'N/A',
            actual_model=thinking_config.get('model', thinking_model) if thinking_config else thinking_model,
            base_url=thinking_config.get('base_url', '') if thinking_config else '',
            kb_info_section=self._format_kb_info(kb_info_list),
            tool_info_section=self._format_tool_info(tool_info_list)
        )

        # Call thinking LLM for decomposition
        if not thinking_config:
            return "# 错误\n\n无法获取思考模型配置，请检查模型配置。"

        try:
            # Sanitize base_url
            base_url = thinking_config.get('base_url', '')
            if base_url and base_url.endswith("/chat/completions"):
                base_url = base_url.replace("/chat/completions", "")
                if base_url.endswith("/"):
                    base_url = base_url.rstrip("/")

            llm = ChatOpenAI(
                model=thinking_config.get('model', thinking_model),
                openai_api_key=thinking_config.get('api_key'),
                openai_api_base=base_url,
                temperature=0.7
            )

            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ]

            print(f"Calling thinking LLM for requirement decomposition: {thinking_model}")
            response = await llm.ainvoke(messages)
            decomposition_doc = response.content

            # Add metadata header
            header = f"""# {agent_data.get('name', '未命名')} - 需求拆解文档

> 生成时间: {self._get_current_time()}
> 分析模型: {thinking_model}
> 分析师: AI智能体架构专家

---

"""
            return header + decomposition_doc

        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"Error during requirement decomposition: {e}")
            print(f"Traceback: {error_trace}")
            return f"""# 错误

需求拆解过程中发生错误：

**错误信息**: {str(e)}

**系统提示**: 请检查模型配置是否正确，确保思考模型 `{thinking_model}` 可用。

---

## 调试信息

```
{error_trace}
```
"""

    def _get_current_time(self) -> str:
        from datetime import datetime
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')
