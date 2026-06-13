# D 模块补充设计说明

## 1. 文档目标

本文档用于说明 `feature/user` 分支对应功能的补充方案，覆盖：

- 用户认证完善
- 项目管理页
- 与 D 负责内容直接相关的后端接口、前端页面、状态流转

本文档基于当前仓库已有代码和文档整理，目的是在正式补代码前先统一范围、接口形态和实现顺序。

---

## 2. 当前仓库完成度梳理

### 2.1 已完成部分

根据现有代码，以下基础能力已经可用：

- 后端基础框架已搭好：Express、Prisma、JWT、错误处理、中间件、Socket.io 初始化
- 用户认证后端基础接口已存在：
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `GET /api/me`
- 前端认证基础设施已存在：
  - `authStore` 持久化登录态
  - `request.js` 自动带 token
  - `ProtectedRoute` 登录保护
- 白板模块已经超出 README 中“占位”的状态，后端 `boards` 接口和前端 `BoardPage` 都已有较完整实现
- 文档、Git 协作、接口规范文档基本齐全

### 2.2 D 负责范围当前缺口

当前与 D 直接相关但尚未完成的部分如下：

- `client/src/pages/LoginPage.jsx` 仍是占位页
- `client/src/pages/RegisterPage.jsx` 仍是占位页
- `client/src/pages/HomePage.jsx` 仍是占位页
- `server/src/routes/index.js` 中 `/api/items` 路由尚未接入
- 项目管理相关后端控制器、服务、接口封装均不存在
- 当前认证链路“能登录”，但还不算“完善”：
  - 前端没有自动 refresh token 逻辑
  - 后端没有区分 access token / refresh token 的用途
  - 登录页、注册页没有已登录重定向逻辑
  - 应用启动后没有主动校验当前用户信息

### 2.3 当前代码中的相关风险

- `refresh` 接口当前复用了同一个 token 校验逻辑，理论上无法严格区分 access token 和 refresh token
- `request.js` 在收到 `40101` 时直接清空登录态并跳转，没有尝试刷新 token
- Home 页缺失导致用户登录后没有真正的“项目入口”
- API 规范中已约定 `/api/items`，但实际后端尚未实现，前后端存在断层
- 部分现有中文字符串存在编码异常，但这不影响 D 模块设计本身

---

## 3. 本轮补充范围

### 3.1 本轮要完成

本轮建议把 D 模块收敛为下面四块：

1. 登录页
2. 注册页
3. 项目管理页 HomePage
4. 认证链路补全与 `/api/items` 后端实现

### 3.2 本轮不做

以下内容虽然和“认证完善”有关，但不建议在本轮一起做：

- 真实邮箱激活
- 第三方邮件发送能力
- 登录失败锁定机制
- 找回密码
- 用户资料编辑页

原因：

- 当前仓库没有邮件服务配置，也没有对应环境变量规范
- README 与 `docs/api-spec.md` 对 D 的核心要求聚焦在 `Login / Register / HomePage / /api/items`
- 如果本轮把认证安全增强全部拉进来，范围会明显膨胀，影响主线交付

结论：

- 本轮把“认证完善”定义为“完成可用的登录注册体验 + token 刷新链路 + 登录状态恢复 + 页面访问控制”

---

## 4. 目标交付效果

完成后，用户流程应为：

1. 未登录用户访问 `/` 会被重定向到 `/login`
2. 用户可以在 `/register` 完成注册
3. 注册成功后跳转 `/login`，并提示注册成功
4. 用户在 `/login` 登录成功后进入 `/`
5. 首页展示当前用户可访问的协作项目列表
6. 用户可创建新项目，项目类型为：
   - `Whiteboard`
   - `Document`
7. 用户可点击项目进入：
   - 白板项目进入 `/board/:id`
   - 文档项目进入 `/doc/:id`
8. token 过期时前端优先尝试刷新，而不是立刻登出
9. 已登录用户访问 `/login` 或 `/register` 时，会被重定向回首页

---

## 5. 详细设计

## 5.1 认证模块完善方案

### 5.1.1 后端 token 方案调整

当前问题：

- access token 和 refresh token 都用同一套签发与校验逻辑
- `refresh` 接口无法严格限制“只能用 refresh token”

建议调整：

- access token payload 增加 `token_type: 'access'`
- refresh token payload 增加 `token_type: 'refresh'`
- `verifyToken(token, expectedType)` 支持校验 token 类型
- `authMiddleware` 只接受 `access`
- `refresh()` 只接受 `refresh`
- Socket 握手鉴权只接受 `access`

这样改动较小，但能把认证链路补完整。

### 5.1.2 前端自动刷新 token

在 `client/src/api/request.js` 中补充以下逻辑：

- 普通请求先自动带上 `accessToken`
- 如果接口返回 `40101`
  - 且本地存在 `refreshToken`
  - 且当前请求不是 `/auth/refresh`
  - 则自动调用 `/auth/refresh`
- 刷新成功后：
  - 更新本地 `accessToken`
  - 重放原始请求
- 刷新失败后：
  - 清空登录态
  - 跳转 `/login`

补充状态要求：

- 避免多个并发请求同时刷新 token
- 需要一个刷新中的共享 Promise，后续请求等待同一个刷新结果

### 5.1.3 前端登录态恢复与访客页控制

建议调整：

- `App.jsx` 仍保留 `loadFromStorage()`
- 首页进入后调用一次 `getMe()` 校验当前用户是否仍有效
- `LoginPage` / `RegisterPage` 若检测到已有 `accessToken`，直接跳 `/`

这样可以让认证状态更闭环。

---

## 5.2 项目管理 API 设计

项目管理模块统一使用 `CollaborativeItem` 表，不新增新表。

### 5.2.1 路由清单

新增路由前缀：

- `/api/items`

具体接口：

1. `GET /api/items`
2. `POST /api/items`
3. `GET /api/items/:id`
4. `PUT /api/items/:id/permissions`

### 5.2.2 GET /api/items

用途：

- 获取当前用户拥有或被授权访问的全部项目

返回字段建议：

```json
[
  {
    "item_id": "uuid",
    "title": "项目标题",
    "type": "Whiteboard",
    "owner_id": "uuid",
    "is_public": false,
    "created_at": "2026-06-04T00:00:00.000Z",
    "updated_at": "2026-06-04T00:00:00.000Z",
    "role": "owner"
  }
]
```

说明：

- `role` 是前端首页判断操作权限的重要字段，建议直接返回
- 列表页阶段不返回完整 `content_data`

### 5.2.3 POST /api/items

用途：

- 创建协作项目

请求体建议：

```json
{
  "title": "需求评审白板",
  "type": "Whiteboard"
}
```

校验规则：

- `title` 必填，去首尾空格后不能为空
- 最长 256 字
- `type` 仅允许：
  - `Whiteboard`
  - `Document`

创建规则：

- `owner_id` 为当前登录用户
- 自动创建 owner 权限记录
- 初始 `content_data`：
  - `Whiteboard`：`{ "canvas": null }`
  - `Document`：`{ "content": "" }`

返回值：

- 返回新建项目基础信息和当前用户角色

### 5.2.4 GET /api/items/:id

用途：

- 获取项目详情
- 作为 HomePage 中“成员管理”弹窗的数据来源

返回字段建议：

```json
{
  "item_id": "uuid",
  "title": "需求评审白板",
  "type": "Whiteboard",
  "owner_id": "uuid",
  "is_public": false,
  "created_at": "2026-06-04T00:00:00.000Z",
  "updated_at": "2026-06-04T00:00:00.000Z",
  "role": "owner",
  "owner": {
    "user_id": "uuid",
    "username": "alice",
    "email": "alice@example.com"
  },
  "permissions": [
    {
      "permission_id": "uuid",
      "role": "editor",
      "user": {
        "user_id": "uuid",
        "username": "bob",
        "email": "bob@example.com"
      }
    }
  ]
}
```

权限规则：

- owner / editor / viewer 都可以查看详情
- 无权限用户返回 `40301`

### 5.2.5 PUT /api/items/:id/permissions

用途：

- 项目 owner 管理成员权限

建议请求体：

```json
{
  "members": [
    { "email": "bob@example.com", "role": "editor" },
    { "email": "carol@example.com", "role": "viewer" }
  ]
}
```

设计说明：

- 该接口采用“完整覆盖式更新”而不是“单条增删改”
- `members` 表示除 owner 本人外，项目最终应保留的成员列表
- 后端根据 email 查找用户：
  - 已存在则 upsert 权限
  - 不在新列表中的旧成员则删除

限制规则：

- 仅 owner 可调用
- 不能修改 owner 自己的 owner 角色
- `role` 仅允许 `editor`、`viewer`
- 若 email 对应用户不存在，返回 `40401`

这样前端实现最简单，适合本项目当前阶段。

---

## 5.3 后端实现结构

新增文件：

- `server/src/routes/items.routes.js`
- `server/src/controllers/item.controller.js`
- `server/src/services/item.service.js`

并在 `server/src/routes/index.js` 中挂载：

```js
router.use('/items', itemRoutes);
```

### 5.3.1 service 层职责

建议实现以下方法：

- `listItems(userId)`
- `createItem(userId, data)`
- `getItemDetail(userId, itemId)`
- `updateItemPermissions(userId, itemId, members)`

建议抽出权限辅助函数：

- `getItemRole(userId, itemId)`
- `assertItemReadable(userId, itemId)`
- `assertItemOwner(userId, itemId)`

这样风格与当前 `board.service.js` 保持一致。

### 5.3.2 与 Board / Doc 的关系

HomePage 只负责“项目入口管理”，不负责具体编辑功能。

跳转规则：

- `type === 'Whiteboard'` -> `/board/:id`
- `type === 'Document'` -> `/doc/:id`

因此 D 模块只需要保证项目创建和入口列表正常，不需要实现文档编辑器本身。

---

## 5.4 前端页面设计

`DESIGNE.md` 给出的视觉方向明显偏 Notion 风格，因此 D 负责的三页建议统一走：

- 浅色背景
- 大留白
- 简洁卡片
- 轻边框
- 主色使用蓝色 CTA

### 5.4.1 LoginPage

目标：

- 让登录成为完整可用页面，而不是占位文字

页面组成：

- 左侧品牌介绍区
- 右侧登录卡片
- 表单字段：
  - `email`
  - `password`
- 操作：
  - 登录按钮
  - 去注册页入口

交互规则：

- 表单前端校验邮箱格式和必填项
- 提交时按钮 loading
- 登录成功后：
  - `setAuth(result)`
  - `navigate('/')`
- 已登录则自动跳首页

### 5.4.2 RegisterPage

页面组成：

- 与登录页风格统一
- 表单字段：
  - `username`
  - `email`
  - `password`
  - `confirmPassword`

交互规则：

- 用户名必填
- 邮箱格式校验
- 密码至少 8 位
- 两次密码必须一致
- 注册成功后跳转 `/login`
- 可携带 `state` 或 query，给登录页展示“注册成功，请登录”

### 5.4.3 HomePage

目标：

- 成为登录后的统一入口页

页面组成建议：

1. 顶部导航栏
2. 页面标题区
3. “新建项目”按钮
4. 项目列表区域
5. 成员管理弹窗

列表展示字段：

- 标题
- 类型
- 角色
- 更新时间

操作按钮：

- `进入`
- `管理成员`

显示规则：

- owner 可见“管理成员”
- editor / viewer 不显示该按钮

空状态：

- 当列表为空时展示空状态卡片，引导创建第一个项目

### 5.4.4 新建项目弹窗

建议用 Ant Design `Modal + Form`

字段：

- 标题
- 类型

成功后：

- 刷新列表
- 直接跳转到新项目对应页面

### 5.4.5 成员管理弹窗

建议使用 `Modal`，内部采用可编辑列表。

能力：

- 输入成员邮箱
- 选择角色 `editor/viewer`
- 删除成员
- 保存后调用 `PUT /api/items/:id/permissions`

为控制复杂度，本轮不做：

- 模糊搜索用户
- 邀请邮件
- 批量导入成员

---

## 5.5 前端接口层与状态层调整

### 5.5.1 新增 `client/src/api/item.api.js`

建议提供：

- `listItems()`
- `createItem(data)`
- `getItemDetail(id)`
- `updateItemPermissions(id, data)`

### 5.5.2 调整 `authStore.js`

建议新增能力：

- `setAccessToken(accessToken)`
- `clearAuth()` 或继续复用 `logout()`

原因：

- refresh 成功时只会拿到新 access token，不应覆盖整个 user

### 5.5.3 请求拦截器与 store 解耦

当前 `request.js` 为避免循环依赖，直接操作 localStorage，这个方向可以保留。

但为了让 refresh 更稳定，建议：

- token key 常量从 `authStore.js` 或单独常量文件中共享
- 避免 magic string 分散在多个文件里

---

## 6. 计划修改文件清单

### 6.1 后端

- `server/src/utils/jwt.js`
- `server/src/middlewares/auth.js`
- `server/src/services/auth.service.js`
- `server/src/routes/index.js`
- `server/src/routes/items.routes.js`
- `server/src/controllers/item.controller.js`
- `server/src/services/item.service.js`
- 如有必要：`docs/api-spec.md`

### 6.2 前端

- `client/src/api/request.js`
- `client/src/api/auth.api.js`
- `client/src/api/item.api.js`
- `client/src/store/authStore.js`
- `client/src/pages/LoginPage.jsx`
- `client/src/pages/RegisterPage.jsx`
- `client/src/pages/HomePage.jsx`
- 如有必要：`client/src/components/Navbar.jsx`

---

## 7. 实现顺序建议

建议按下面顺序做，风险最低：

1. 先补后端 `/api/items`
2. 再补 token 类型区分与 refresh 链路
3. 再补前端 `item.api.js` 和 `authStore` 小改动
4. 实现 LoginPage
5. 实现 RegisterPage
6. 实现 HomePage
7. 最后联调注册、登录、刷新 token、项目创建、项目进入、成员管理

---

## 8. 验收标准

满足以下条件即可认为 D 模块主线完成：

- `/login` 可登录，成功后进入首页
- `/register` 可注册，成功后跳登录
- `/` 可展示当前用户项目列表
- 可创建白板项目和文档项目
- 可从首页进入对应项目页
- owner 可管理成员权限
- token 过期时可自动 refresh
- refresh 失败时会正确清空登录态并回到 `/login`
- 已登录用户不会停留在 `/login` 或 `/register`

---

## 9. 本文档中的默认实现假设

为了减少反复确认，本文档默认采用以下假设：

- 本轮不引入新数据库表
- 本轮不接入邮件服务
- 成员管理通过 email 识别用户
- 权限更新接口采用“完整覆盖式更新”
- HomePage 允许创建 `Whiteboard` 和 `Document` 两种项目
- 文档项目创建后可进入 `/doc/:id`，即使 C 的编辑器尚未完成

如果这些假设你认可，我们下一步就可以直接按这份文档开始补代码。
