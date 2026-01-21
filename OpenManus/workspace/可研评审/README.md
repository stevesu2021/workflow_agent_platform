# 可研评审

## Description

可研评审Agentic智能体

## Installation

```bash
pip install -r requirements.txt
```

## Configuration

Set up environment variables:

```bash
export LLM_API_KEY="your-api-key"
export LLM_BASE_URL="https://api.openai.com/v1"
```

## Usage

```python
from agent import create_agent

# Create agent instance
agent = create_agent()

# Run synchronously
result = agent.run("Your input here")
print(result)

# Or stream asynchronously
import asyncio

async def main():
    async for event in agent.astream_run("Your input here"):
        print(event)

asyncio.run(main())
```

## LangGraph Structure

### Nodes

- step_1: 系统初始化
- **功能描述**：初始化智能体，加载配置和资源
- **输入数据**：无
- **处理逻辑**：
  1. 加载系统提示词
  2. 初始化LLM实例
  3. 加载知识库配置
  4. 初始化AgentState
- **输出数据**：初始化的AgentState
- **使用组件**：LLM（系统配置）
- **提示词模板**：
  ```
  系统初始化完成。你将作为国网公司科技方向专家，对电网工程可研材料进行评审。
  ```
- step_2: 规则提取与索引构建
- **功能描述**：从Excel文件中提取评审规则并建立索引
- **输入数据**：Excel文件路径（来自资源文件）
- **处理逻辑**：
  1. 使用pandas读取Excel文件
  2. 提取所有规则字段
  3. 按规则类别分组
  4. 构建规则索引（编号、类别、关键词）
  5. 将规则转换为结构化对象
- **输出数据**：
  - rules: 规则列表
  - rules_index: 规则索引
  - rule_categories: 规则类别列表
- **使用组件**：Python脚本（pandas）
- **提示词模板**：
  ```
  请分析Excel文件中的评审规则，提取所有规则并按类别整理。
  规则类别包括：技术规范、安全标准、环保要求、经济性分析等。
  ```
- step_3: PDF内容提取
- **功能描述**：提取PDF文件的文本内容并结构化
- **输入数据**：用户上传的PDF文件
- **处理逻辑**：
  1. 使用pdfplumber或PyPDF2提取文本
  2. 识别章节结构（标题、子标题）
  3. 提取段落内容
  4. 识别并提取表格数据
  5. 构建内容索引
- **输出数据**：
  - pdf_content: 完整文本内容
  - pdf_metadata: 文档结构信息
- **使用组件**：Python脚本（pdfplumber）
- **提示词模板**：
  ```
  请分析PDF文档结构，提取文本内容并识别章节、段落和表格数据。
  重点关注技术参数、设计方案、经济指标等信息。
  ```
- step_4: 规则-内容语义匹配
- **功能描述**：将每条规则与PDF内容进行语义匹配
- **输入数据**：规则列表、PDF内容
- **处理逻辑**：
  1. 对每条规则，使用知识库进行语义检索
  2. 在PDF内容中查找相关段落
  3. 计算匹配置信度
  4. 提取匹配的内容片段
- **输出数据**：
  - rule_matches: 规则与内容的匹配映射
  - match_confidence: 匹配置信度
- **使用组件**：知识库检索 + LLM语义分析
- **提示词模板**：
  ```
  请将以下规则与PDF内容进行匹配：
  规则：{规则描述}
  PDF内容：{相关段落}
  请判断PDF内容是否涉及该规则，并提取相关参数。
  ```
- step_5: 单规则评审（循环执行）
- **功能描述**：对单条规则进行详细评审
- **输入数据**：规则详情、匹配的PDF内容
- **处理逻辑**：
  1. 分析规则类型（技术、安全、经济等）
  2. 提取规则中的合格标准
  3. 在PDF内容中查找对应指标
  4. 进行比对分析
  5. 生成评审意见
- **输出数据**：
  - rule_id: 规则编号
  - rule_name: 规则名称
  - review_result: 评审结果（通过/不通过/需补充）
  - review_details: 详细说明
  - suggestions: 建议措施
- **使用组件**：LLM推理
- **提示词模板**：
  ```
  作为国网公司科技方向专家，请评审以下规则：
  
  规则编号：{rule_id}
  规则描述：{rule_description}
  评审要点：{review_points}
  合格标准：{compliance_standard}
  
  PDF相关内容：{matched_content}
  
  请：
  1. 判断PDF内容是否满足该规则
  2. 如果不满足，指出具体问题
  3. 提出改进建议
  4. 给出评审结果（通过/不通过/需补充）
  ```
- step_6: 评审结果汇总
- **功能描述**：汇总所有规则的评审结果，生成最终报告
- **输入数据**：所有单规则评审结果
- **处理逻辑**：
  1. 按规则类别分组
  2. 统计评审结果分布
  3. 生成评审摘要
  4. 格式化详细报告
  5. 生成改进建议汇总
- **输出数据**：
  - review_summary: 评审摘要
  - detailed_report: 详细评审报告
  - improvement_suggestions: 改进建议汇总
- **使用组件**：LLM总结
- **提示词模板**：
  ```
  请汇总以下所有规则的评审结果，生成一份完整的评审报告：
  
  评审结果列表：{review_results}
  
  请生成：
  1. 评审摘要（总体结论、通过率、主要问题）
  2. 按类别分组的详细评审结果
  3. 改进建议汇总
  4. 最终评审结论
  ```
- step_7: 输出格式化
- **功能描述**：将评审结果格式化为用户友好的输出
- **输入数据**：评审汇总结果
- **处理逻辑**：
  1. 生成Markdown格式的报告
  2. 添加标题、目录
  3. 突出显示关键信息
  4. 确保格式清晰易读
- **输出数据**：格式化的评审报告文本
- **使用组件**：LLM格式化
- **提示词模板**：
  ```
  请将以下评审结果格式化为清晰的Markdown报告：
  
  评审摘要：{summary}
  详细结果：{details}
  改进建议：{suggestions}
  
  要求：
  - 使用标题和子标题组织内容
  - 突出显示不通过的项目
  - 使用列表格式化建议
  - 确保结构清晰，易于阅读
  ```

### Edges (Transitions)

- step_1 → step_2
- step_2 → step_3
- step_3 → step_4
- step_4 → step_5
- step_5 → step_6
- step_6 → step_7

## Tools Used

- No tools defined

## Knowledge Bases

- d38f78a9-19dd-45cd-8286-390f4638764e

## License

MIT License
