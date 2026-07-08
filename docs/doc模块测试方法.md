# doc 模块测试方法

> 登录页尚未实现，需通过命令行完成认证和文档创建，再手动注入 token 进入页面。

---

## 1. 启动项目

分别在 `server` 和 `client` 目录下运行：

```powershell
# 后端（新终端）
cd e:\SoftWE\CollabPlatform\server
npm run dev

# 前端（新终端）
cd e:\SoftWE\CollabPlatform\client
npm run dev
```

---

## 2. 注册账号（首次使用）

```powershell
# 注册用户1
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
  -Method POST -ContentType "application/json" `
  -Body '{"username":"user1","email":"user1@test.com","password":"12345678"}'

# 注册用户2（用于测试多人协作）
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
  -Method POST -ContentType "application/json" `
  -Body '{"username":"user2","email":"user2@test.com","password":"12345678"}'
```

---

## 3. 登录并创建文档

```powershell
# 登录，保存 token
$res = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email":"user1@test.com","password":"12345678"}'
$token = $res.data.accessToken
$userId = $res.data.user.user_id
Write-Host "user_id:" $userId
Write-Host "token:" $token

# 创建文档
$doc = Invoke-RestMethod -Uri "http://localhost:3000/api/docs" `
  -Method POST -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body '{"title":"测试文档"}'
$docId = $doc.data.item_id
Write-Host "doc URL: http://localhost:5173/doc/$docId"
```

---

## 4. 在浏览器中注入 token（必做）

打开 `http://localhost:5173`，按 **F12 → Console**，粘贴以下代码（替换成上一步输出的值）：

```javascript
localStorage.setItem('collab_access_token', '粘贴token')
localStorage.setItem('collab_refresh_token', '粘贴refreshToken')
localStorage.setItem('collab_user', JSON.stringify({
  user_id: "粘贴user_id",
  username: "user1",
  email: "user1@test.com"
}))
```

执行后在地址栏输入上一步打印的文档 URL。

> **提示**：`JWT_EXPIRES_IN` 已设为 `7d`，token 7天内有效，不需要频繁重新登录。

---

## 5. 多人协作测试

用两个不同浏览器（如 Chrome + Edge）分别登录 `user1` 和 `user2`，打开同一文档 URL。

`user2` 默认没有文档权限，需先由 `user1`（owner）邀请：

```powershell
# user1 邀请 user2 为 editor
Invoke-RestMethod -Uri "http://localhost:3000/api/docs/$docId/members/invite" `
  -Method POST -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body '{"email_or_username":"user2@test.com","role":"editor"}'
```

邀请成功后，user2 在自己的浏览器中注入 token 并打开同一文档 URL，即可看到双方光标和内容实时同步。

---

## 6. 功能验收清单

| 功能 | 操作 | 预期结果 |
|------|------|---------|
| 编辑器加载 | 打开文档 URL | 显示 TipTap 编辑器，不是占位文字 |
| 标题编辑 | 修改标题，停止输入 2 秒 | 自动保存，刷新后标题仍在 |
| 富文本 | Ctrl+B / Ctrl+I，标题、列表 | 格式正常应用 |
| 内容持久化 | 编辑后刷新 | 内容仍在 |
| 实时协作 | 两浏览器同时编辑 | 对方光标实时可见，内容 300ms 内同步 |
| 评论 | 选中文本 → 右侧面板 → 新建评论 | 评论出现在右侧面板 |
| 版本快照 | 右侧面板 → 版本 → 创建快照 | 版本列表出现新条目 |
| 导出 | 顶部工具栏 → 导出 | 下载 .md 或 .html 文件 |
| 邀请成员 | 右侧面板 → 成员 → 邀请 | 被邀请者可访问文档 |

---

## 常见问题

**Q：打开文档显示「加载文档失败」**
A：token 已过期或无效，重新执行第 3 步登录拿新 token 并重新注入。

**Q：实时同步不工作，顶部显示「协作通道已断开」**
A：检查后端是否正常运行，以及 token 是否有效（Socket 连接也需要鉴权）。

**Q：评论功能报「评论锚点无效」**
A：必须先在正文中选中一段文本，再点评论按钮，不能在空白处直接评论。

**Q：`Comment` 表相关操作报 Prisma 错误**
A：数据库的 `Comment` 表可能缺少 `parent_id` 列，在 Supabase SQL Editor 执行：
```sql
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "parent_id" TEXT REFERENCES "Comment"("comment_id") ON DELETE CASCADE;
```
