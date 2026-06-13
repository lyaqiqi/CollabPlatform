# CollabPlatform

多人实时协作平台——支持**共享白板**和**共享文档**，基于 React 18 + Node.js + Socket.io 构建。

## 快速开始

见 [docs/getting-started.md](docs/getting-started.md)。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 18 + Vite |
| 前端路由 | react-router-dom v6 |
| 前端状态管理 | Zustand |
| 前端 HTTP | axios |
| 前端 WebSocket | socket.io-client |
| 前端 UI 库 | Ant Design (antd) |
| 富文本编辑器 | TipTap（基于 ProseMirror）|
| 文档协作内核 | Yjs（CRDT）+ y-protocols（Awareness）+ y-prosemirror |
| 文档导出 | turndown + turndown-plugin-gfm（HTML→Markdown） |
| 后端框架 | Node.js + Express |
| ORM | Prisma |
| 数据库 | PostgreSQL（Supabase） |
| 缓存 | Redis（可选，不配置时自动降级） |
| 实时通信 | Socket.io |
| 鉴权 | jsonwebtoken + bcrypt |
| 日志 | morgan |
| AI 助手 | DeepSeek（OpenAI 兼容接口）+ SSE 流式输出（后端原生 fetch，无新增依赖） |

---

## 目录结构

```
CollabPlatform/
├── client/                         # 前端 React 应用（Vite）
│   ├── index.html
│   ├── vite.config.js
│   ├── .env / .env.example
│   └── src/
│       ├── api/
│       │   ├── request.js          # axios 实例（统一拦截器）
│       │   ├── auth.api.js         # 认证相关接口封装
│       │   ├── board.api.js        # 【B】白板接口封装（CRUD）
│       │   ├── doc.api.js          # 【C】文档模块接口封装（docs/comments/versions/members）
│       │   ├── folder.api.js       # 【C】文档树/文件夹接口封装（folders 树 + 文档归类）
│       │   └── ai.api.js           # 【C】AI 助手接口封装（SSE 流式，原生 fetch）
│       ├── collab/                 # 【C】文档协作底层（Yjs over Socket.io）
│       │   ├── socketIoYjsProvider.js  # 自定义 Yjs Provider，复用 useSocket 通道
│       │   ├── yjsUtils.js         # base64 ↔ Uint8 / 状态编码 / 快照注水
│       │   └── userColor.js        # 由 userId 派生协作光标颜色
│       ├── components/
│       │   ├── Navbar.jsx          # 顶部导航栏
│       │   ├── Loading.jsx         # 全屏加载 Spin
│       │   ├── Toast.js            # 全局消息提示（antd message）
│       │   ├── ConfirmDialog.jsx   # 确认弹窗（antd Modal.confirm）
│       │   ├── DocEditor.jsx       # 【C】TipTap 富文本编辑器（协作 + 评论锚点 + 撤销）
│       │   ├── DocCollabSidebar.jsx# 【C】协作侧边栏（评论/版本/成员）
│       │   ├── doc-editor/         # 【C】编辑器浮层
│       │   │   ├── SelectionBubbleMenu.jsx  # 选区气泡工具栏（含 AI 入口）
│       │   │   ├── SlashCommandMenu.jsx     # 斜杠 “/” 命令菜单
│       │   │   ├── TableBubbleMenu.jsx      # 表格操作气泡菜单
│       │   │   ├── AIBubbleActions.jsx      # 【C】选区 AI 动作下拉（改写/翻译/总结…）
│       │   │   └── AIInlineResult.jsx       # 【C】AI 内联结果浮层（替换/插入/重试/丢弃）
│       │   └── doc-layout/         # 【C】文档页沉浸式布局
│       │       ├── DocShell.jsx             # 三栏外壳（左目录/中编辑器/右面板）
│       │       ├── DocImmersiveHeader.jsx   # 顶部栏（标题/在线用户/操作）
│       │       ├── DocLeftSidebar.jsx       # 左侧大纲目录 + 知识库文档树
│       │       ├── DocTree.jsx              # 【C】文档树/文件夹（antd Tree 拖拽 + 增删改）
│       │       ├── DocRightPanel.jsx        # 右侧评论/版本/搜索/AI 面板
│       │       ├── DocAIPanel.jsx           # 【C】右侧 AI 对话面板（携带文档上下文）
│       │       └── DocTitleBlock.jsx        # 标题块（含保存状态）
│       ├── hooks/
│       │   ├── useDocCollaboration.js  # 【C】创建 Y.Doc + Provider + 在线用户派生
│       │   ├── useAIAssistant.js        # 【C】AI 助手状态（内联动作 + 对话）
│       │   └── useTreeSync.js           # 【C】订阅 tree:* Socket 事件，驱动 treeStore 增量/全量更新
│       ├── pages/
│       │   ├── LoginPage.jsx       # 登录页（占位，由 D 实现）
│       │   ├── RegisterPage.jsx    # 注册页（占位，由 D 实现）
│       │   ├── HomePage.jsx        # 项目列表页（占位，由 D 实现）
│       │   ├── BoardPage.jsx       # 【B】白板编辑页（Fabric.js，已实现）
│       │   └── DocPage.jsx         # 【C】文档编辑页（已实现）
│       ├── router/
│       │   ├── index.jsx           # 路由表（BrowserRouter）
│       │   └── ProtectedRoute.jsx  # 路由守卫（未登录跳 /login）
│       ├── socket/
│       │   └── useSocket.js        # WebSocket 客户端封装（hook）
│       ├── store/
│       │   ├── authStore.js        # 登录态（Zustand，含 localStorage 持久化）
│       │   └── treeStore.js        # 【C】文档树全局状态（Zustand，供 DocTree + useTreeSync 共用）
│       ├── styles/                 # 【C】文档模块样式
│       │   ├── doc-tokens.css      # 设计变量
│       │   ├── doc-layout.css      # 三栏布局
│       │   ├── doc-editor.css      # 编辑器正文样式
│       │   └── doc-overlays.css    # 气泡菜单/弹层
│       ├── utils/
│       │   └── constants.js        # 错误码、Socket 事件名常量
│       ├── App.jsx                 # 根组件（路由 + 连接状态横幅）
│       └── main.jsx                # 入口，挂载 React App
│
├── server/                         # 后端 Node.js + Express 服务
│   ├── prisma/
│   │   ├── schema.prisma           # 数据库模型定义（6 张表，Comment 含 parent_id 自关联，Folder 自关联树）
│   │   └── migrations/             # 迁移记录（init + add_comment_parent_id + add_folder_tree）
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js              # 读取并校验环境变量（缺失则退出）
│   │   │   ├── prisma.js           # PrismaClient 单例
│   │   │   └── redis.js            # ioredis 客户端（含容错降级）
│   │   ├── middlewares/
│   │   │   ├── auth.js             # JWT 鉴权中间件（挂 req.user）
│   │   │   ├── errorHandler.js     # 统一错误处理（AppError → 标准格式）
│   │   │   └── requestLogger.js    # morgan 请求日志
│   │   ├── utils/
│   │   │   ├── AppError.js         # 自定义错误类（httpStatus + code + message）
│   │   │   ├── response.js         # success() / fail() 响应封装
│   │   │   └── jwt.js              # signAccessToken / signRefreshToken / verifyToken
│   │   ├── routes/
│   │   │   ├── index.js            # 路由总入口（挂到 /api）
│   │   │   ├── auth.routes.js      # /api/auth/*
│   │   │   ├── health.routes.js    # /api/health、/api/me
│   │   │   ├── boards.routes.js    # 【B】/api/boards/*（白板 CRUD）
│   │   │   ├── doc.routes.js       # 【C】/api/docs/*（文档/评论/版本/成员/文件夹归类）
│   │   │   ├── folder.routes.js    # 【C】/api/folders/*（文档树/文件夹 CRUD）
│   │   │   └── ai.routes.js        # 【C】/api/ai/*（AI 动作 / 对话，SSE）
│   │   ├── controllers/
│   │   │   ├── auth.controller.js  # 认证控制器（req/res 处理）
│   │   │   ├── board.controller.js # 【B】白板控制器
│   │   │   ├── doc.controller.js   # 【C】文档控制器
│   │   │   ├── folder.controller.js# 【C】文件夹控制器
│   │   │   └── ai.controller.js    # 【C】AI 控制器（SSE 流式下发）
│   │   ├── services/
│   │   │   ├── auth.service.js     # 认证业务逻辑（注册、登录、refresh）
│   │   │   ├── board.service.js    # 【B】白板业务逻辑（权限校验 + CRUD）
│   │   │   ├── doc.service.js      # 【C】文档业务逻辑（权限校验 + 评论/版本/成员 + 文件夹归类）
│   │   │   ├── folder.service.js   # 【C】文件夹业务逻辑（树查询 + CRUD + 防环校验）
│   │   │   └── ai.service.js       # 【C】AI 业务逻辑（调用 DeepSeek 流式补全）
│   │   ├── socket/
│   │   │   ├── index.js            # Socket.io 初始化 + 通用方法
│   │   │   └── handlers.js         # 事件注册（join/leave/ping + 【C】doc:* 协作事件）
│   │   ├── app.js                  # Express 应用装配
│   │   └── index.js                # 启动入口（HTTP server + Socket.io）
│   ├── .env / .env.example
│   └── package.json
│
├── docs/
│   ├── api-spec.md                 # 接口规范 & 错误码 & Socket 事件表
│   ├── git-workflow.md             # 分支策略、PR 流程、commit 格式
│   └── getting-started.md         # 组员上手步骤 + 代码示例
├── .gitignore
├── DESIGN.md                 # UI 风格统一规定（借鉴Notion）
└── README.md
```

---

## 架构说明

### 整体架构

```
浏览器
  │
  ├─ HTTP (axios) ──────────► Express /api/*
  │                               │
  │                           路由 → 控制器 → 服务层 → Prisma → PostgreSQL
  │
  └─ WebSocket (socket.io) ─► Socket.io Server
                                  │
                              连接鉴权（JWT）
                                  │
                              房间管理（joinRoom/leaveRoom）
                                  │
                              广播（broadcastToRoom）
```

前后端完全分离，前端运行在 `localhost:5173`（Vite），后端运行在 `localhost:3000`（Express）。两者通过以下两条通道通信：

- **HTTP**：用于增删改查类操作（注册/登录/获取数据等），前端通过封装好的 `axios` 实例发起，自动携带 JWT token。
- **WebSocket**：用于实时同步（白板笔迹、文档内容、在线用户），前端通过 `useSocket` hook 封装的 socket.io-client 建立长连接，后端在 Socket.io 层做连接鉴权和房间管理。

---

### 后端分层说明

#### 1. 配置层（`src/config/`）

| 文件 | 作用 |
|------|------|
| `env.js` | 用 dotenv 加载 `.env`，校验关键变量（`DATABASE_URL`、`JWT_SECRET`）缺失则直接退出进程，避免带着错误配置启动 |
| `prisma.js` | 导出 PrismaClient 单例，开发模式下挂到 `global` 防止热重载时重复建连接 |
| `redis.js` | 用 ioredis 连接 Redis，**如果 `REDIS_URL` 为空或连接失败，打印警告但不崩溃**，导出一个 Proxy 空操作客户端，使业务代码无需关心 Redis 是否可用 |

#### 2. 工具层（`src/utils/`）

| 文件 | 作用 |
|------|------|
| `AppError.js` | 自定义错误类，携带 `httpStatus`（HTTP 状态码）和 `code`（业务错误码）。业务层 `throw new AppError(...)` 即可，错误中间件统一捕获并格式化返回 |
| `response.js` | 封装 `success(res, data)` 和 `fail(res, httpStatus, code, message)`，**所有接口必须通过这两个函数返回**，保证格式一致 |
| `jwt.js` | 封装 token 的签发（access 15m / refresh 7d）和校验，校验失败直接抛 `AppError(401, 40101)` |

#### 3. 中间件层（`src/middlewares/`）

| 文件 | 作用 |
|------|------|
| `requestLogger.js` | morgan 日志，记录每个请求的方法、路径、状态码、耗时 |
| `auth.js` | 从 `Authorization: Bearer <token>` 头取 token，调 `verifyToken` 校验，成功后把 `{ userId }` 挂到 `req.user`，供控制器使用 |
| `errorHandler.js` | 放在所有路由之后，统一捕获 `AppError`（按其字段返回）和其他未知错误（返回 500），开发模式下打印堆栈 |

#### 4. 业务层（`routes → controllers → services`）

采用三层结构，职责清晰：

```
routes/        只负责声明 URL 路径和 HTTP 方法，把请求转发给 controller
controllers/   只负责处理 req/res，从 req 取参数，调 service，用 response 工具返回
services/      只负责纯业务逻辑：查库、计算、抛 AppError，不感知 HTTP
```

这样的好处：service 可以被多个 controller 复用，也方便写单元测试。

#### 5. Socket.io 层（`src/socket/`）

| 文件 | 作用 |
|------|------|
| `index.js` | 初始化 Socket.io，在 `io.use()` 中间件里做连接级鉴权（校验 `handshake.auth.token`）。导出 `joinRoom`、`leaveRoom`、`broadcastToRoom`、`broadcastToTreeRoom` 四个通用方法供组员在业务 handler 里调用 |
| `handlers.js` | 为每条连接注册具体事件：`join`/`leave`（调通用房间方法，`join` 会先做文档 viewer 权限校验）、`ping`/`pong`（联调自测）。**C 已扩展文档协作事件**：`doc:operation`、`doc:cursor`、`doc:title-changed`、`doc:sidebar-changed`（权限不足时回传 `doc:error`）；**文档树实时同步事件**：`tree:subscribe`/`tree:unsubscribe`（加入/离开 `tree:{userId}` 个人树房间）。B 的白板事件按相同模式扩展 |

房间命名约定：
- **协作项目房间**：`item:<itemId>`，一个协作项目对应一个房间，所有在同一项目内的用户共享此房间的广播。每个 `doc:*` 事件处理器都会先调用 `docService.assertDocumentAccess` 做权限校验，再 `broadcastToRoom`（排除发送者自己）。
- **文档树房间**：`tree:<userId>`，每个登录用户独占一个树房间，该用户的所有标签页共享此房间。文件夹/文档增删改后，`folder.controller` / `doc.controller` 通过 `broadcastToTreeRoom` 向操作者推送细粒度增量事件（`tree:folder-*` / `tree:doc-*`），并向所有与其有共享文档关系的协作者推送 `tree:reload`，触发全量刷新。

---

### 数据库模型说明

共 6 张表，主键统一用 UUID：

```
User
 ├─ 1:N ─► CollaborativeItem（owner）
 ├─ N:M ─► CollaborativeItem（通过 Permission，含 role: owner/editor/viewer）
 ├─ 1:N ─► Folder（owner，个人知识库文件夹树）
 └─ 1:N ─► Comment（author）

CollaborativeItem（type: Whiteboard | Document）
 ├─ N:1 ─► Folder（folder_id，可空，onDelete: SetNull）
 ├─ 1:N ─► Version（版本快照，onDelete: Cascade）
 ├─ 1:N ─► Comment（评论，onDelete: Cascade）
 └─ 1:N ─► Permission（成员权限，onDelete: Cascade）

Folder（文档树/文件夹，【C】）
 └─ 1:N ─► Folder（parent_id 自关联，onDelete: Cascade 子文件夹连带删）
```

删除 `CollaborativeItem` 时，其关联的 `Version`、`Comment`、`Permission` 全部级联删除。
删除 `Folder` 时，子文件夹级联删除，其下文档的 `folder_id` 置空（`SetNull`，文档不删、退回未分类）。

---

### 前端模块说明

#### 1. 状态管理（`store/`）

**`authStore.js`**：用 Zustand 管理登录态，包含 `user`、`accessToken`、`refreshToken` 三个字段。

- `setAuth()`：登录成功后调用，同时把 token 写入 `localStorage` 实现持久化
- `logout()`：清空 state 和 `localStorage`
- `loadFromStorage()`：在 `App.jsx` 的 `useEffect` 里调用，页面刷新后自动恢复登录态

**`treeStore.js`**：用 Zustand 管理文档树（文件夹 + 文档节点）全局状态，被 `DocTree` 读取，由 `useTreeSync` 驱动更新。

| 方法 | 说明 |
|------|------|
| `fetchTree()` | 全量加载（初始化 + `tree:reload` 触发时调用） |
| `applyFolderCreated/Updated/Deleted` | 细粒度增量更新文件夹（`tree:folder-*` 事件） |
| `applyDocCreated/Moved/Deleted` | 细粒度增量更新文档节点（`tree:doc-*` 事件） |
| `snapshot() / rollback(snap)` | 拖拽乐观更新的快照与回滚 |

#### 2. HTTP 封装（`api/request.js`）

基于 axios 创建实例，配置了两层拦截器：

- **请求拦截**：自动从 `localStorage` 读取 `accessToken`，加到 `Authorization: Bearer` 头，业务代码无需手动传 token
- **响应拦截**：
  - `code === 0` → 直接返回 `res.data.data`，业务层拿到的就是纯数据，无需解包
  - `code === 40101`（token 失效）→ 自动清理登录态并跳转 `/login`
  - 其他错误码 → 自动弹出 Toast 错误提示并 reject
  - 网络层错误 → 弹「网络异常」

#### 3. WebSocket 封装（`socket/useSocket.js`）

这是 B（白板）和 C（文档）最重要的基础设施，设计要点：

- **单例模式**：`socketInstance` 是模块级变量，多个组件调用 `useSocket()` 共享同一条 WebSocket 连接，不会重复建连接
- **连接鉴权**：`connect()` 时从 `localStorage` 取 token，通过 `handshake.auth.token` 传给服务端
- **自动重连**：socket.io-client 内置重连机制，配置了初始 1s 延迟、最大 5s 延迟、无限重试
- **状态枚举**：暴露 `status` 字段（`disconnected / connecting / connected / reconnecting / recovered`），`App.jsx` 读取此状态显示全局连接状态横幅
- **内存泄漏防护**：`on()` 注册的监听器需要在组件卸载时调用 `off()` 解绑（页面组件里的 `useEffect` return 里处理）

暴露的方法：

| 方法 | 说明 |
|------|------|
| `connect()` | 建立连接（幂等，已连接则跳过） |
| `disconnect()` | 主动断开 |
| `joinRoom(itemId)` | 加入协作项目房间 |
| `leaveRoom(itemId)` | 离开协作项目房间 |
| `emit(event, data)` | 发送事件 |
| `on(event, handler)` | 监听事件 |
| `off(event, handler)` | 取消监听 |
| `ping()` | 连通性自测，返回 Promise\<time\> |

#### 4. 路由与守卫

| 路径 | 组件 | 是否受保护 | 负责人 |
|------|------|-----------|--------|
| `/login` | LoginPage | 否 | D |
| `/register` | RegisterPage | 否 | D |
| `/` | HomePage | 是 | D |
| `/board/:id` | BoardPage | 是 | B |
| `/doc/:id` | DocPage（已实现） | 是 | C |

`ProtectedRoute` 检查 `authStore.accessToken`，无 token 则 `<Navigate to="/login" />`。

#### 5. 公共 UI 组件

| 组件 | 用法 |
|------|------|
| `<Navbar />` | 顶部栏，显示用户名和退出登录按钮，在已登录页面引入 |
| `<Loading />` | 居中全屏 Spin，数据加载时使用 |
| `Toast.success/error/info(msg)` | 全局消息提示，在任意 JS/JSX 文件直接调用 |
| `ConfirmDialog.show({ title, onOk })` | 删除等危险操作前的确认弹窗 |

#### 6. 文档实时协作架构（C，已实现）

文档采用 **Yjs（CRDT）** 做无冲突合并，复用框架的 `useSocket` 作为传输层，不依赖第三方协作服务器：

```
TipTap 编辑器 ──► Y.Doc（CRDT）──► SocketIoYjsProvider ──► useSocket ──► Socket.io
   ▲                  ▲  ▲                                                   │
   │                  │  └─ Awareness（光标/在线用户）── doc:cursor ──────────┤
   │                  └──── 增量 update ── doc:operation ─────────────────────┤
   └─ CollaborationCursor / Collaboration 扩展                  房间内其他成员 ◄┘
```

关键文件与职责：

| 文件 | 职责 |
|------|------|
| `hooks/useDocCollaboration.js` | 创建 `Y.Doc`、`SocketIoYjsProvider`、`Y.UndoManager`，加入房间，并从 Awareness 实时派生去重后的在线用户列表 |
| `collab/socketIoYjsProvider.js` | 自定义 Yjs Provider：把本地 `ydoc.update` / Awareness 变更编码为 base64 经 `doc:operation` / `doc:cursor` 广播；收到远端更新用 `Y.applyUpdate` 合并。用 `origin` 区分远端回传与本地注水，避免回环 |
| `collab/yjsUtils.js` | `encodeYjsState` / `applyPersistedYjsState` 等：Yjs 状态与 base64 互转、历史快照注水 |
| `components/DocEditor.jsx` | TipTap 编辑器，集成 Collaboration / CollaborationCursor、表格/任务列表/代码高亮/图片/链接、评论锚点高亮装饰、斜杠命令、协作安全的撤销重做（委托 `Y.UndoManager`） |

协作要点（供联调/二次开发参考）：

- **实时编辑不落库**：编辑过程只走 Socket 增量同步；持久化仅在「防抖 2s 保存 / 离开页面 / 创建版本快照」时调用 `PUT /api/docs/:id` 写入整篇 `yjs_state`。
- **首次注水只做一次**：打开文档后用接口返回的 `content_data.yjs_state` 注水（`origin='persisted'`），该 origin 不会被再次广播，避免污染他人文档。
- **在线用户去重**：同一用户多标签/刷新会产生多条 clientID，按 `user.id` 去重展示。
- **断线提示**：`connected` 为 false 时正文区顶部显示离线横幅，重连后 Yjs 自动补偿差异。
- **版本恢复**：`restore` 接口在服务端广播 `doc:version-restored`，房间内所有人（含操作者）收到后 reload 页面拉取最新快照。

---

### 统一响应格式与错误码

**所有接口**统一返回：

```json
{ "code": 0, "data": { ... }, "message": "success" }
{ "code": 40001, "data": null, "message": "请求参数错误" }
```

| code | 含义 |
|------|------|
| 0 | 成功 |
| 40001 | 请求参数错误 |
| 40101 | 未登录 / token 失效 |
| 40301 | 无权限操作 |
| 40401 | 资源不存在 |
| 40901 | 资源冲突（如邮箱已注册） |
| 50000 | 服务器内部错误 |

详见 [docs/api-spec.md](docs/api-spec.md)。

---

## 五人分工

| 成员 | 分支 | 负责模块 | 状态 |
|------|------|----------|------|
| A（框架） | main | 本框架搭建 | ✅ 已完成 |
| B | feature/board | 白板实时协作（Fabric.js 画布 + Socket 事件） | ✅ 基本完成 |
| C | feature/doc | 文档实时协作（TipTap + Yjs CRDT + Socket 事件） | ✅ 已完成 |
| D | feature/user | 用户认证完善 & 项目管理页（Login / Register / HomePage） | ❌ 未开始 |
| E | feature/collab | 版本快照 & 评论功能（Version / Comment 接口） | ❌ 未开始 |

---

## 框架已完成的能力清单

- [x] Monorepo 结构、统一 .gitignore
- [x] 后端环境变量加载与校验
- [x] Prisma schema：5 张表，关系与级联删除完整，`prisma generate` 通过
- [x] Redis 容错降级（未配置时不崩溃）
- [x] 统一响应格式（`success` / `fail`）
- [x] 统一错误码常量（`AppError.CODES`）
- [x] 自定义 `AppError` + 错误中间件
- [x] JWT 工具：签发 access/refresh token、校验
- [x] 鉴权中间件 `authMiddleware`（挂 `req.user`）
- [x] 认证接口：`POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/refresh`
- [x] 示例接口：`GET /api/health`（无需鉴权）、`GET /api/me`（需鉴权）
- [x] Socket.io 初始化 + 连接鉴权
- [x] 通用方法：`joinRoom` / `leaveRoom` / `broadcastToRoom`
- [x] Socket 基础事件：`join`（按 item 类型分流白板/文档权限校验）/ `leave` / `ping` / `pong`
- [x] 前端 Vite + React 18 工程
- [x] 五条路由 + `ProtectedRoute` 路由守卫
- [x] `authStore`（Zustand）：登录态 + localStorage 持久化（同步初始化，首次渲染即可用，无竞态问题）
- [x] `request.js`：axios 实例，自动带 token，统一错误拦截
- [x] `useSocket`：单例、自动重连、状态管理、完整房间方法
- [x] 公共组件：`Navbar` / `Loading` / `Toast` / `ConfirmDialog`
- [x] 团队文档：接口规范 / Git 协作约定 / 上手指南

### 白板模块已完成的能力清单（B）

- [x] 后端 `/api/boards/*` 全套接口（白板 CRUD，owner/editor/viewer 三级权限校验）
- [x] 画布工具：选择、手绘、矩形、椭圆、箭头、文字（Fabric.js）
- [x] 元素操作：拖拽移动、缩放、删除
- [x] 撤销/重做（本地操作栈，最多 50 步）
- [x] 防抖自动保存（停止操作 1.2s 后落库）+ 手动保存
- [x] 实时多人同步：画布增量广播（`board:sync`）、多人光标位置（`board:cursor`）
- [x] 导出 PNG（`canvas.toDataURL()`）
- [x] 进入房间时从后端加载已保存的画布内容

> 注：实时同步使用 canvas JSON 整体广播方案，未按规范使用 Y.js CRDT，多人同时操作时后写覆盖先写。

### 文档模块已完成的能力清单（C）

- [x] 后端 `/api/docs/*` 全套接口（文档 CRUD、评论+回复、版本+回滚、成员邀请/移除/调权）
- [x] 三层结构 + 基于 `owner/editor/viewer` 的权限校验（`assertDocumentAccess`）
- [x] 评论支持锚点定位（选区 from/to + selected_text）与回复树
- [x] 版本快照与一键回滚（含 Socket 全员同步 reload）
- [x] Socket 文档协作事件：`doc:operation` / `doc:cursor` / `doc:title-changed` / `doc:sidebar-changed` / `doc:version-restored` / `doc:error`
- [x] 前端 TipTap 富文本编辑器（表格/任务列表/代码高亮/图片/链接/斜杠命令/气泡菜单）
- [x] Yjs CRDT 实时协作（自定义 Socket.io Provider）+ 协作光标 + 在线用户
- [x] 协作安全的撤销/重做（`Y.UndoManager`）
- [x] 评论锚点高亮（位置漂移时按文本重新定位）
- [x] 大纲目录、全文搜索、Markdown/HTML 导出、分享链接
- [x] **文档树/文件夹（知识库）**：多级文件夹 CRUD、拖拽移动文档/文件夹、防环校验、删除文件夹文档退回未分类（`/api/folders/*` + 左栏 `DocTree`）
- [x] **文档树实时协作同步**：基于 Socket `tree:*` 事件 + Zustand `treeStore` 实现：
  - 同用户多标签页间文件夹/文档增删改的细粒度实时同步（`tree:folder-created/updated/deleted`、`tree:doc-created/moved/deleted`）
  - 协作者（被分享文档的用户）的树视图实时同步（`tree:reload`）
  - `GET /api/folders/tree` 纳入共享文档 owner 的完整文件夹树（只读，`shared: true, readonly: true`），协作者刷新后可见 owner 的文件夹组织结构
- [x] 防抖自动保存 + 离开页面兜底保存
- [x] Prisma 迁移：`Comment.parent_id` 自关联（评论回复）、`Folder` 自关联树 + `CollaborativeItem.folder_id`

### AI 文档助手已完成的能力清单（C）

- [x] 后端 `/api/ai/*`：`action`（选中文本动作）、`chat`（文档对话），均经鉴权
- [x] 调用 DeepSeek（OpenAI 兼容）`/chat/completions`，**SSE 流式**逐字下发
- [x] 后端使用 Node 原生 `fetch`，无新增依赖；客户端断开时中止上游请求
- [x] 9 种选中文本动作：优化/修语法/摘要/解释/扩写/精简/续写/翻译中英
- [x] 选区气泡菜单 AI 入口（`AIBubbleActions`）+ 内联结果浮层（`AIInlineResult`）
- [x] 内联结果先预览，确认「替换 / 插入到后方」后才写回编辑器，不污染 Yjs 协作撤销栈
- [x] 右侧 `AI 助手` 面板（`DocAIPanel`）：自由对话，自动携带当前文档纯文本作为上下文
- [x] 前端原生 `fetch` + `ReadableStream` 解析 SSE（`ai.api.js`）、统一状态 hook（`useAIAssistant`）

> 配置：在 `server/.env` 填写 `DEEPSEEK_API_KEY` 后即可启用（另有 `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` 可选）。需 Node 18+（依赖全局 `fetch`）。
