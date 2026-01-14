我将为您实现完整的 **MCP (Model Context Protocol) 管理功能**。由于目前代码库中 MCP 功能完全空白，我将采用以下全栈开发方案：

### 1. 数据库模型设计 (Backend)
我将复用现有的 `AiResource` 模型来存储 MCP Server 配置，而不是创建新表。这能保持架构简洁。
*   **模型**: `AiResource` (已存在)
*   **扩展**: 使用 `type='mcp_server'` 来标识 MCP 服务器。
*   **配置字段 (`config` JSON)**:
    ```json
    {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/username/Desktop"],
      "env": { ... }
    }
    ```

### 2. 后端 API 开发 (Backend)
我将扩展 `ai_resources` 模块或创建新的逻辑来处理 MCP Server 的特有操作。
*   **CRUD 接口**: 利用现有的 `/ai-resources` 接口进行增删改查。
*   **新接口: 获取工具列表 (`POST /mcp/list-tools`)**:
    *   这是一个关键的新功能。后端需要根据 MCP Server 的配置（command/args），实际启动该 Server 进程，并通过 MCP 协议（Stdio）与其通信，调用 `tools/list` 方法获取工具列表。
    *   我将在 `app/services` 下创建一个 `mcp_client.py` 服务，专门负责与 MCP Server 进程交互。

### 3. 前端页面开发 (Frontend)
我将重写 `frontend/src/pages/MCPManager.tsx`。
*   **列表页**: 展示已配置的 MCP Server（卡片式布局）。
*   **添加/编辑模态框**:
    *   名称 (Name)
    *   配置 JSON (Config JSON): 提供一个 CodeMirror 或类似的代码编辑器输入框，用于输入 `command`, `args`, `env` 等。
*   **详情/工具查看**:
    *   点击 Server 卡片上的“查看工具”按钮。
    *   前端调用后端 `/mcp/list-tools` 接口。
    *   弹窗展示该 Server 提供的工具列表（名称、描述、JSON Schema）。

### 4. 实施步骤
1.  **后端**: 创建 `app/services/mcp_service.py`，实现与 MCP Server 的 stdio 通信逻辑（使用 `mcp` python SDK 或子进程调用）。
2.  **后端**: 在 `app/api/mcp.py` (新建) 中添加路由，暴露 MCP 相关操作。
3.  **后端**: 在 `app/main.py` 中注册新路由。
4.  **前端**: 开发 `MCPManager.tsx`，实现 CRUD 和工具列表查看 UI。

**依赖项确认**: 后端需要安装 `mcp` SDK (如果可用) 或直接使用 `subprocess` 管理。鉴于环境限制，我将优先使用标准库 `subprocess` 或查看是否已安装 `mcp` 库。

是否同意此计划？
