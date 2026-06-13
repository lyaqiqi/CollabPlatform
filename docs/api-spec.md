# CollabPlatform 接口规范

## 统一响应格式

所有接口均返回以下 JSON 格式：

```json
// 成功
{ "code": 0, "data": <任意>, "message": "success" }

// 失败
{ "code": <错误码>, "data": null, "message": "<错误描述>" }
```

## 错误码表

| code  | HTTP 状态 | 含义 |
|-------|-----------|------|
| 0     | 2xx       | 成功 |
| 40001 | 400       | 请求参数错误 |
| 40101 | 401       | 未登录 / token 失效 |
| 40301 | 403       | 无权限操作 |
| 40401 | 404       | 资源不存在 |
| 40901 | 409       | 资源冲突（如邮箱已注册） |
| 50000 | 500       | 服务器内部错误 |

## 命名约定

- **URL**：小写复数，连字符分隔，如 `/api/items`、`/api/items/:id/versions`
- **JSON 字段**：统一 `snake_case`，与数据库字段保持一致

## 鉴权说明

需要登录的接口，请求头携带：

```
Authorization: Bearer <accessToken>
```

accessToken 有效期默认 7 天（可在 `server/.env` 调整），过期后用 refreshToken 调 `/api/auth/refresh` 换新 token。

---

## 已实现接口

### 认证模块 `/api/auth`

#### POST /api/auth/register — 注册

请求体：
```json
{ "username": "alice", "email": "alice@example.com", "password": "12345678" }
```

成功响应（201）：
```json
{ "code": 0, "data": { "user_id": "...", "username": "alice", "email": "...", "created_at": "..." }, "message": "注册成功" }
```

错误：`40001`（参数错误）、`40901`（邮箱/用户名已注册）

#### POST /api/auth/login — 登录

请求体：
```json
{ "email": "alice@example.com", "password": "12345678" }
```

成功响应（200）：
```json
{
  "code": 0,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": { "user_id": "...", "username": "alice", "email": "..." }
  },
  "message": "登录成功"
}
```

#### POST /api/auth/refresh — 刷新 token

请求体：`{ "refreshToken": "..." }`

成功响应：`{ "code": 0, "data": { "accessToken": "..." }, "message": "token 刷新成功" }`

### 示例接口

#### GET /api/health — 健康检查（无需鉴权）

```json
{ "code": 0, "data": { "status": "ok", "time": "2024-01-01T00:00:00.000Z" }, "message": "success" }
```

#### GET /api/me — 当前用户信息（需鉴权）

成功响应：
```json
{ "code": 0, "data": { "user_id": "...", "username": "alice", "email": "...", "status": "active" }, "message": "success" }
```

---

## 业务接口预留位置（待组员实现）

### 白板模块（由 B 实现）— `/api/boards`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | /api/boards | 获取白板列表 |
| POST | /api/boards | 新建白板 |
| GET  | /api/boards/:id | 获取白板详情 |
| PUT  | /api/boards/:id | 更新白板内容 |
| DELETE | /api/boards/:id | 删除白板 |

### 文档模块（C，已实现）— `/api/docs`

> 状态：**已实现**。所有接口均需鉴权（`router.use(authMiddleware)`），返回统一响应格式。
> 字段命名统一 `snake_case`；JSON 字段中的 ID 一律为 UUID 字符串。

| 方法 | 路径 | 说明 | 最低权限 |
|------|------|------|----------|
| GET    | /api/docs | 获取当前用户可见的文档列表 | 登录 |
| POST   | /api/docs | 新建文档 | 登录 |
| GET    | /api/docs/:id | 获取文档详情（含 `content_data`） | viewer |
| GET    | /api/docs/:id/sidebar | 一次性拉取协作侧边栏数据（评论/版本/成员/统计） | viewer |
| PUT    | /api/docs/:id | 保存文档（标题 / Yjs 快照） | editor |
| DELETE | /api/docs/:id | 删除文档（级联删评论/版本/权限） | owner |
| PATCH  | /api/docs/:id/folder | 把文档移入/移出文件夹（知识库归类） | editor |
| GET    | /api/docs/:id/comments | 获取评论列表（含回复树） | viewer |
| POST   | /api/docs/:id/comments | 发表锚点评论 | editor |
| POST   | /api/docs/:id/comments/:commentId/replies | 回复某条评论 | editor |
| PATCH  | /api/docs/:id/comments/:commentId/resolve | 标记评论解决/未解决 | editor |
| GET    | /api/docs/:id/versions | 获取版本快照列表 | viewer |
| POST   | /api/docs/:id/versions | 创建版本快照 | editor |
| POST   | /api/docs/:id/versions/:versionId/restore | 回滚文档到指定版本 | editor |
| GET    | /api/docs/:id/members | 获取文档成员（含 owner） | viewer |
| POST   | /api/docs/:id/members/invite | 通过邮箱/用户名邀请成员 | owner |
| PUT    | /api/docs/:id/members/:targetUserId | 设置成员权限（viewer/editor） | owner |
| DELETE | /api/docs/:id/members/:targetUserId | 移除成员 | owner |

> **权限模型**：`owner > editor > viewer`。owner 为文档创建者，其余成员通过 `Permission` 表授予角色。
> 写操作（保存、评论、版本）要求 `editor` 及以上；成员管理、删除文档仅 `owner`。

#### 文档 DTO（`content_data` 约定）

`GET /api/docs/:id` 返回的文档对象结构：

```json
{
  "item_id": "uuid",
  "type": "Document",
  "title": "我的文档",
  "owner_id": "uuid",
  "is_public": false,
  "folder_id": null,
  "content_data": { "yjs_state": "<base64 编码的 Y.encodeStateAsUpdate(ydoc)>" },
  "created_at": "...",
  "updated_at": "...",
  "feature_flags": { "comments": true, "versions": true, "permissions": true, "presence": true }
}
```

- `content_data.yjs_state`：整篇文档的 Yjs 状态快照（base64）。新建文档时为 `null`。
- 前端打开文档后用 `Y.applyUpdate(ydoc, base64ToUint8(yjs_state))` 注水，实时编辑走 Socket（见下文），仅在防抖/离开/打快照时通过 `PUT` 落库。

#### POST /api/docs — 新建

请求体：`{ "title": "可选标题" }`（不传则默认「未命名文档」）。成功返回 201 + 文档 DTO。

#### PUT /api/docs/:id — 保存

请求体（两个字段都可选，按需提交）：

```json
{
  "title": "我的文档",
  "content_data": { "yjs_state": "<base64 编码的 Y.encodeStateAsUpdate>" }
}
```

> `content_data` 会与已存值浅合并；`title` 为空字符串会被拒绝（40001）。

#### GET /api/docs/:id/sidebar — 侧边栏聚合数据

一次性返回评论（含回复，取最新 50 条顶层评论）、版本（最新 20 条）、成员、统计：

```json
{
  "comments": [ /* CommentDTO，见下 */ ],
  "versions": [ /* VersionDTO */ ],
  "members": [ { "user_id": "...", "username": "...", "email": "...", "role": "owner" } ],
  "stats": { "comment_count": 3, "version_count": 5, "member_count": 2 }
}
```

#### POST /api/docs/:id/comments — 发表锚点评论

请求体（`position` 必填，锚定到正文选区）：

```json
{
  "content": "这里的定义建议补充来源",
  "position": { "from": 120, "to": 158, "selected_text": "被评论的正文片段" }
}
```

- 校验：`content` 非空；`from >= 1` 且 `to > from`，否则 40001（请先选择正文文本）。
- CommentDTO 结构：

```json
{
  "comment_id": "uuid",
  "item_id": "uuid",
  "author_id": "uuid",
  "parent_id": null,
  "content": "...",
  "position": { "type": "selection", "from": 120, "to": 158, "selected_text": "..." },
  "is_resolved": false,
  "created_at": "...",
  "author": { "user_id": "...", "username": "...", "email": "..." },
  "replies": [ /* 嵌套 CommentDTO */ ]
}
```

#### POST /api/docs/:id/comments/:commentId/replies — 回复评论

请求体：`{ "content": "回复内容" }`。回复会继承父评论的 `position`，返回 201 + CommentDTO。

#### PATCH /api/docs/:id/comments/:commentId/resolve — 标记解决

请求体：`{ "is_resolved": true }`。

#### POST /api/docs/:id/versions — 创建版本快照

请求体（`content_snapshot` 建议带上 `yjs_state` 才可被恢复）：

```json
{
  "content_snapshot": {
    "yjs_state": "<base64>",
    "title": "我的文档",
    "label": "阶段性存档",
    "created_by": "<userId>"
  }
}
```

VersionDTO：`{ "version_id", "item_id", "content_snapshot", "created_at" }`。

#### POST /api/docs/:id/versions/:versionId/restore — 回滚版本

无请求体。将文档 `content_data` 覆盖为该版本的 `yjs_state`（无 `yjs_state` 则报 40001），并通过 Socket 广播 `doc:version-restored` 通知房间内所有人 reload。返回恢复后的文档 DTO。

#### POST /api/docs/:id/members/invite — 邀请成员

请求体：`{ "email_or_username": "bob@x.com", "role": "editor" }`（`role` 仅允许 `viewer` / `editor`）。
按邮箱或用户名查找用户（找不到 404），已是成员则 upsert 更新角色。返回成员 DTO。

#### PATCH /api/docs/:id/folder — 移动文档到文件夹

请求体：`{ "folder_id": "uuid 或 null" }`（传 `null` 表示移出到「未分类」）。

- 需要文档 `editor` 及以上权限；目标文件夹必须属于当前用户（否则 403/404）。
- 返回更新后的文档 DTO（含新的 `folder_id`）。

### 文档树/文件夹模块（C，已实现）— `/api/folders`

> 状态：**已实现**。所有接口均需鉴权（`router.use(authMiddleware)`），返回统一响应格式。
> 文件夹是**按 owner 归属的共享知识库**：每个用户维护自己的一棵文件夹树，文档通过 `CollaborativeItem.folder_id` 挂入文件夹。
> **跨用户可见性**：若用户 B 拥有来自用户 A 的共享文档，`GET /api/folders/tree` 会同时返回 A 的全部文件夹（标记为 `shared: true, readonly: true`），B 可看到共享文档在 A 的文件夹树中的完整层级位置，但不可对这些文件夹执行创建/重命名/删除操作。

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET    | /api/folders/tree | 一次性拉取当前用户的整棵文件夹树 + 可访问的文档节点 | 登录 |
| POST   | /api/folders | 新建文件夹 | 登录 |
| PATCH  | /api/folders/:id | 重命名 / 移动（改 `parent_id`）/ 调整排序 | folder owner |
| DELETE | /api/folders/:id | 删除文件夹 | folder owner |

> 文档的「移入/移出文件夹」走文档模块的 `PATCH /api/docs/:id/folder`（见上）。

#### GET /api/folders/tree — 文件夹树 + 文档节点

返回扁平的 `folders` + `documents`，由前端组装成层级树：

```json
{
  "folders": [
    { "folder_id": "f1", "owner_id": "u1", "parent_id": null, "name": "团队规范", "sort_order": 0, "created_at": "...", "updated_at": "..." },
    { "folder_id": "f2", "owner_id": "u2", "parent_id": null, "name": "A的文件夹", "sort_order": 0, "shared": true, "readonly": true, "created_at": "...", "updated_at": "..." }
  ],
  "documents": [
    { "item_id": "d1", "title": "接口设计", "folder_id": "f1", "owner_id": "u1", "updated_at": "...", "shared": false },
    { "item_id": "d2", "title": "他人共享给我的文档", "folder_id": "f2", "owner_id": "u2", "updated_at": "...", "shared": true }
  ]
}
```

- `folders`：当前用户**拥有**的文件夹 + 所有向本用户共享过文档的用户的**全部文件夹**（按 `sort_order` 升序）。
  - 自有文件夹：无额外标记；
  - 外部（共享）文件夹：附加 `"shared": true, "readonly": true`，前端据此屏蔽创建/重命名/删除菜单及拖拽目标。
- `documents`：当前用户**可访问**的全部文档（拥有的 + 被分享的）。
- **共享语义（新）**：文档的 `folder_id` 在合并后的可访问文件夹集合中有效时保留（含外部文件夹），否则返回 `null`（落到根级「未分类」）。`shared: true` 表示该文档非本人创建。

#### POST /api/folders — 新建文件夹

请求体：`{ "name": "新建文件夹", "parent_id": "父文件夹 uuid 或省略" }`。

- `name` 非空、≤128 字符（否则 40001）；`parent_id` 若传，必须属于当前用户。
- 成功返回 201 + 文件夹 DTO。

#### PATCH /api/folders/:id — 重命名 / 移动 / 排序

请求体（字段均可选，按需提交）：

```json
{ "name": "新名称", "parent_id": "新父文件夹 uuid 或 null", "sort_order": 1 }
```

- **防环校验**：移动时若目标父文件夹是自身或自身的后代，返回 40001。
- 返回更新后的文件夹 DTO。

#### DELETE /api/folders/:id — 删除文件夹

- 子文件夹随外键 `onDelete: Cascade` 一并删除。
- 其下文档**不会被删除**：`CollaborativeItem.folder_id` 经 `onDelete: SetNull` 退回「未分类」。

### AI 文档助手模块（C，已实现）— `/api/ai`

> 状态：**已实现**。基于 DeepSeek 的 OpenAI 兼容接口（`/chat/completions`）。
> 所有接口均需鉴权（`router.use(authMiddleware)`）。
> **与其它接口不同，这两个接口以 SSE（Server-Sent Events）流式返回，而非统一 JSON 格式。**

| 方法 | 路径 | 说明 | 最低权限 |
|------|------|------|----------|
| POST | /api/ai/action | 对选中文本执行预设动作（改写/翻译/总结等），流式返回 | 登录 |
| POST | /api/ai/chat | 文档 AI 对话（携带文档上下文），流式返回 | 登录 |

#### SSE 响应格式

响应头：`Content-Type: text/event-stream; charset=utf-8`。响应体按行推送，每条消息形如：

```
data: {"token":"片段文字"}\n\n     # 一个增量内容片段（可能出现多次）
data: {"error":"错误描述"}\n\n      # 流式过程中出错（响应头已发送时）
data: [DONE]\n\n                    # 流结束标志
```

> 前端封装见 `client/src/api/ai.api.js`（原生 `fetch` + `ReadableStream` 解析，axios 无法增量读取）。
> 客户端断开连接（`AbortController.abort()`）时，服务端会中止对 DeepSeek 的上游请求，避免无谓的 token 消耗。
> 鉴权失败等在「响应头发送前」发生的错误，仍按统一 JSON 格式返回（如 `{ "code": 40101, ... }`）。

#### POST /api/ai/action — 选中文本动作

请求体：

```json
{ "action": "improve", "text": "需要处理的选中文本" }
```

`action` 取值（与后端 `ACTION_PROMPTS` 一致）：

| action | 含义 |
|--------|------|
| `improve` | 优化写作，更流畅专业 |
| `fix_grammar` | 修正语法 / 错别字 / 标点 |
| `summarize` | 生成摘要 |
| `explain` | 解释内容 |
| `expand` | 扩写内容 |
| `shorten` | 精简内容 |
| `continue` | 续写 |
| `translate_en` | 翻译为英文 |
| `translate_zh` | 翻译为中文 |

- 校验：`action` 与 `text` 均非空，且 `action` 在上表之内，否则 40001。

#### POST /api/ai/chat — 文档对话

请求体：

```json
{
  "messages": [
    { "role": "user", "content": "帮我总结这篇文档" },
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "再列出三个要点" }
  ],
  "docContext": "当前文档的纯文本（前端用 editor.getText() 取得，后端截断到 4000 字作为上下文）"
}
```

- 校验：`messages` 为非空数组，否则 40001。`docContext` 可选。

#### 配置项（`server/.env`）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEEPSEEK_API_KEY` | （空） | DeepSeek API Key，**必填才能启用**；为空时调用返回 500 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | 接口基址，会拼接 `/chat/completions` |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 使用的模型 |

### 项目管理模块（由 D 实现）— `/api/items`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | /api/items | 获取当前用户的所有协作项目 |
| POST | /api/items | 创建协作项目 |
| GET  | /api/items/:id | 获取项目详情 |
| PUT  | /api/items/:id/permissions | 更新成员权限 |

### 版本与评论模块（由 E 实现）

> 说明：当前实现已并入文档模块，优先使用 `/api/docs/:id/*` 路径；以下为早期规划保留。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | /api/items/:id/versions | 获取版本列表 |
| POST | /api/items/:id/versions | 创建版本快照 |
| GET  | /api/items/:id/comments | 获取评论列表 |
| POST | /api/items/:id/comments | 发表评论 |
| PATCH | /api/items/:id/comments/:cid | 解决评论 |

### Socket 事件约定

> 连接需在 `handshake.auth.token` 携带 accessToken；服务端 `io.use()` 校验后把 `userId` 挂到 `socket.data`。
> 房间命名 `item:<itemId>`。事件名常量前端在 `client/src/utils/constants.js` 的 `SOCKET_EVENTS` 统一维护。

#### 基础事件（框架已提供）

| 事件名 | 方向 | 参数 | 说明 |
|--------|------|------|------|
| `join` | C→S | `{ itemId }` | 加入房间（服务端会先做文档 viewer 权限校验） |
| `leave` | C→S | `{ itemId }` | 离开房间 |
| `ping` | C→S | — | 连通性检测 |
| `pong` | S→C | `{ time }` | 响应 ping |
| `user:joined` | S→C | `{ userId, itemId }` | 广播：某用户加入房间 |
| `user:left` | S→C | `{ userId, itemId }` | 广播：某用户离开房间 |

#### 文档协作事件（C，已实现）

| 事件名 | 方向 | 参数 | 说明 |
|--------|------|------|------|
| `doc:operation` | C↔S | `{ itemId, update }` | Yjs 增量同步。`update` 为 base64 编码的 `Y.encodeStateAsUpdate`/`Y.UpdateMessage`。服务端校验 editor 权限后广播给房间内**除发送者外**的成员；回传时附带 `userId` |
| `doc:cursor` | C↔S | `{ itemId, update }` | 协作光标 / Awareness 同步（base64 编码的 awareness update）。viewer 即可，广播除发送者外的成员 |
| `doc:title-changed` | C↔S | `{ itemId, title }` | 标题变更通知。editor 权限，广播除发送者外的成员 |
| `doc:sidebar-changed` | C↔S | `{ itemId }` | 评论/版本有变更，通知其他成员静默刷新侧边栏。viewer 权限 |
| `doc:version-restored` | S→C | `{ itemId, restoredBy }` | 某成员回滚了版本，全员（含操作者）需 reload 文档。由 `restore` 接口在服务端主动广播 |
| `doc:error` | S→C | `{ itemId, code, message }` | 文档 Socket 操作权限校验失败时回传给发送者 |

> **协作链路说明**：实时编辑不走 HTTP，而是通过 Yjs CRDT + Socket 广播实现无冲突合并。
> 前端封装见 `client/src/collab/socketIoYjsProvider.js`（自定义 Yjs Provider，复用 `useSocket`）与
> `client/src/hooks/useDocCollaboration.js`。持久化只在防抖保存 / 离开页面 / 创建版本快照时通过 `PUT /api/docs/:id` 落库。

#### 白板事件（B，待实现）

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `board:draw` | C↔S | 白板绘制同步 |
| `board:clear` | C↔S | 清空白板 |

#### 文档树实时同步事件（C，已实现）

> 用于跨标签页/跨用户同步文件夹和文档节点的增删改，消除手动刷新需求。
> 客户端通过 `tree:subscribe` 加入 `tree:{userId}` 个人树房间后，服务端按以下规则推送：
> - **同用户多标签**：文件夹/文档变更时推送细粒度增量事件，前端 `treeStore` 局部更新。
> - **跨用户协作者**：任何可能影响对方树视图的操作（文件夹重命名/删除、文档移动/删除）推送 `tree:reload`，前端全量重新拉取 `GET /api/folders/tree`。

| 事件名 | 方向 | 参数 | 触发时机 |
|--------|------|------|---------|
| `tree:subscribe` | C→S | — | 用户登录后发送，加入 `tree:{userId}` 房间 |
| `tree:unsubscribe` | C→S | — | 组件卸载时发送，离开树房间 |
| `tree:folder-created` | S→C | `{ folder }` | 当前用户新建文件夹后，推送给自身所有标签页 |
| `tree:folder-updated` | S→C | `{ folder }` | 当前用户重命名/移动/排序文件夹后，推送给自身 |
| `tree:folder-deleted` | S→C | `{ folderId }` | 当前用户删除文件夹后，推送给自身 |
| `tree:doc-created` | S→C | `{ doc }` | 当前用户新建文档后，推送给自身 |
| `tree:doc-moved` | S→C | `{ docId, folderId }` | 文档移动到新文件夹后，推送给自身；同时向该文档协作者推送 `tree:reload` |
| `tree:doc-deleted` | S→C | `{ docId }` | 当前用户删除文档后，推送给自身；同时向该文档协作者推送 `tree:reload` |
| `tree:reload` | S→C | — | 跨用户场景：通知协作者文件夹结构已变更，需全量重新拉取树 |

> **前端封装**：`client/src/store/treeStore.js`（Zustand）+ `client/src/hooks/useTreeSync.js`（订阅事件、驱动 store 更新）。`DocLeftSidebar` 调用 `useTreeSync()`，`DocTree` 从 `treeStore` 读取状态，无需手动 `reload()`。
