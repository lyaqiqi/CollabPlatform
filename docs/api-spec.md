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

accessToken 有效期 15 分钟，过期后用 refreshToken 调 `/api/auth/refresh` 换新 token。

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

### 文档模块（由 C 实现）— `/api/docs`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | /api/docs | 获取文档列表 |
| POST | /api/docs | 新建文档 |
| GET  | /api/docs/:id | 获取文档详情 |
| PUT  | /api/docs/:id | 更新文档内容 |
| DELETE | /api/docs/:id | 删除文档 |

### 项目管理模块（由 D 实现）— `/api/items`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | /api/items | 获取当前用户的所有协作项目 |
| POST | /api/items | 创建协作项目 |
| GET  | /api/items/:id | 获取项目详情 |
| PUT  | /api/items/:id/permissions | 更新成员权限 |

### 版本与评论模块（由 E 实现）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | /api/items/:id/versions | 获取版本列表 |
| POST | /api/items/:id/versions | 创建版本快照 |
| GET  | /api/items/:id/comments | 获取评论列表 |
| POST | /api/items/:id/comments | 发表评论 |
| PATCH | /api/items/:id/comments/:cid | 解决评论 |

### Socket 事件约定

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `join` | C→S | 加入房间，参数 `{ itemId }` |
| `leave` | C→S | 离开房间，参数 `{ itemId }` |
| `ping` | C→S | 连通性检测 |
| `pong` | S→C | 响应 ping，返回 `{ time }` |
| `user:joined` | S→C | 广播：某用户加入房间 |
| `user:left` | S→C | 广播：某用户离开房间 |
| `board:draw` | C↔S | 白板绘制同步（由 B 实现） |
| `doc:operation` | C↔S | 文档操作同步（由 C 实现） |
| `doc:cursor` | C↔S | 文档光标同步（由 C 实现） |
