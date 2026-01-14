我将为您实现完整的智能体管理与 Agentic 智能体构建功能。由于这是一个涉及前后端多模块的复杂任务，我将分步骤实施。

### 1. 数据库模型扩展 (Backend)
我需要在 `Agent` 模型中增加字段以区分“工作流编排型”和“Agentic 型”智能体，并为 Agentic 智能体设计配置结构。
*   **修改 `Agent` 模型**:
    *   增加 `type` 字段: `workflow` (默认) 或 `agentic`。
*   **配置结构 (`config` JSON 字段复用)**:
    *   对于 Agentic 智能体，`config` 将存储：
        *   `model_thinking`: 思考模型
        *   `model_summary`: 总结生成模型
        *   `max_thoughts`: 最大思考次数
        *   `tools`: 选用的工具列表 (List[str])
        *   `vocabulary`: 专业词库 (List[str])
        *   `memory_config`: 记忆配置 (变量、表、片段)
        *   `prologue`: 开场白

### 2. 后端 API 更新 (Backend)
*   **API**: 更新 `app/api/agents.py` 以支持 `type` 字段的读写。
*   **逻辑**: 确保创建 Agent 时可以指定类型，且在 `AgentVersion` 中正确存储配置。

### 3. 前端“智能体管理”页面改造 (Frontend)
*   **页面**: `frontend/src/pages/AgentList.tsx` (或新建 `AgentManager.tsx` 替代)。
*   **列表展示**: 增加“类型”列或标签，区分 Workflow 和 Agentic。
*   **操作分流**:
    *   点击 Workflow 类型 -> 跳转现有 `WorkflowStudio`。
    *   点击 Agentic 类型 -> 跳转新页面 `AgenticStudio`。

### 4. 前端“Agentic智能体”构建页面开发 (Frontend)
*   **新页面**: `frontend/src/pages/AgenticStudio.tsx`。
*   **功能模块**:
    *   **基础信息**: 名称、描述、图标。
    *   **模型配置**: 下拉选择思考/总结模型（调用 AI Resources 接口）。
    *   **参数配置**: 最大思考次数 (InputNumber)。
    *   **工具选择**: 多选框，列出系统可用工具 (Tools API)。
    *   **知识增强**: 专业词库编辑器 (Tag Input)。
    *   **记忆配置**: 简单的 Key-Value 编辑器或 JSON 编辑器。
    *   **调试入口**: 右侧提供类似 Chat 的调试窗口（复用或新建）。

### 5. 实施步骤
1.  **后端**: 修改 `app/models/agent.py`，增加 `type` 字段。
2.  **后端**: 迁移数据库（或直接更新表结构，视环境而定）。
3.  **前端**: 创建 `AgenticStudio` 页面及相关组件。
4.  **前端**: 改造 `AgentList` 页面，实现列表区分和跳转逻辑。
5.  **前端**: 在 `AgenticStudio` 中实现表单配置和保存逻辑。

是否同意此计划？
