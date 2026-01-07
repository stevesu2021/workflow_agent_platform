我已完成对“系统设置”页面和相关后端代码的调研，为您制定了在 Action 表格中增加“TestCase”功能的详细实现计划。

### 核心设计思路
由于后端目前主要使用 Mock 数据，我们将重点放在前端交互和“测试用例”的呈现上。我们将创建一个功能丰富的 **TestCase 模态框 (Modal)**，作为资源的“调试控制台”。

### 1. 前端实现 (Frontend)

#### A. 新增组件 `ResourceTestModal.tsx`
这将是一个独立的弹窗组件，用于展示调用细节和执行测试。
*   **顶部信息栏**:
    *   **Request URL**: 显示资源的 Endpoint。
    *   **Request Headers**: 显示将要发送的 Header (如 `Content-Type: application/json`, `Authorization: Bearer ***`)。
*   **交互测试区 (Input Demo)**:
    *   **模板加载**: 根据资源类型 (`TEXT_LLM`, `VISION_LLM` 等) 自动填充标准的 JSON 请求体模板。
    *   **多媒体文件支持 (图片/PDF)**:
        *   设计一个 **"插入文件 (Insert File)"** 工具栏按钮。
        *   用户选择本地图片或 PDF 后，系统自动将其转换为 **Base64 编码**。
        *   自动将 Base64 字符串插入到 JSON 编辑器的光标位置，或者替换模板中的 `<FILE_BASE64>` 占位符。
    *   **JSON 编辑器**: 使用文本域供用户查看和修改请求体。
*   **输出展示区 (Output Demo)**:
    *   显示调用后的响应结果 (JSON 格式)。
    *   如果未执行，可显示该资源类型的标准响应示例。

#### B. 修改 `Settings.tsx`
*   **Action 列更新**: 在表格的 Action 列中增加一个 **"TestCase"** 按钮 (图标可使用 `BugOutlined` 或 `PlayCircleOutlined`)。
*   **状态管理**: 增加 `testingResource` 状态，用于控制 Modal 的显示和当前测试的资源。

#### C. API 客户端更新 (`api/aiResources.ts`)
*   新增 `testResource(id, payload)` 方法，用于将用户的测试数据发送给后端。

### 2. 后端实现 (Backend)

#### A. 新增测试接口 (`app/api/ai_resources.py`)
为了支持真实的测试请求（而不仅仅是连接测试），我们需要一个新的端点。
*   **Endpoint**: `POST /api/ai-resources/{id}/test`
*   **功能**: 接收前端发送的 JSON payload，使用该资源的配置 (Endpoint/Key) 发起实际请求 (或返回 Mock 响应)，并将结果返回给前端。
*   **Service 层**: 在 `AiResourceService` 中添加 `execute_test` 方法。

### 3. 图片/PDF 操作流程规划
针对您特别关心的多媒体操作，流程如下：
1.  用户点击 "TestCase"。
2.  Modal 打开，若为 `VISION_LLM`，输入框预填包含 `image_url` 结构的 JSON。
3.  用户点击 **"Upload Image"** 按钮。
4.  选择本地文件 -> 前端读取文件 -> 转 Base64。
5.  前端自动更新 JSON 输入框，将 `<IMAGE_PLACEHOLDER>` 替换为实际的 `data:image/png;base64,...` 字符串。
6.  用户点击 "Run"，包含图片数据的完整 JSON 被发送到后端进行测试。

### 待确认事项
*   目前后端是 Mock 实现，您是否希望我先实现一个“回显”或简单的 Mock 响应，以便前端流程可以跑通？(默认为：是，确保 UI 交互完整)

请确认是否按照此计划开始编码。