# 组员上手指南

## 1. 克隆仓库

```bash
git clone <仓库地址>
cd collab-platform
```

## 2. 安装依赖

```bash
# 安装后端依赖
cd server && npm install && cd ..

# 安装前端依赖
cd client && npm install && cd ..
```

> 提示：文档模块（C）引入了 TipTap / Yjs / turndown 等新依赖。每次拉取（rebase）了
> `feature/doc` 的改动后，请在 `client` 目录重新执行 `npm install`，否则编辑器会报模块缺失。

## 3. 配置环境变量

```bash
# 后端
cp server/.env.example server/.env
# 编辑 server/.env，填入以下关键字段：
```

`server/.env` 必填字段说明：

| 字段 | 说明 |
|------|------|
| `DATABASE_URL` | Supabase 连接池地址（端口 **6543**），用于应用运行时查询 |
| `DIRECT_URL` | Supabase 直连地址（端口 **5432**），用于 Prisma 迁移建表 |
| `JWT_SECRET` | 自定义随机字符串即可 |
| `JWT_EXPIRES_IN` | 建议开发期间设为 `7d`，避免频繁重新登录 |

**注意**：Supabase 控制台复制的连接串密码带方括号，如 `[your-password]`，填入 `.env` 时必须去掉方括号，只保留 `your-password`。

完整示例：
```
DATABASE_URL=postgresql://postgres.项目ID:密码@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres:密码@db.项目ID.supabase.co:5432/postgres
JWT_SECRET=随机字符串
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173
```

```bash
# 前端（文档实时协作必须）
echo "VITE_WS_URL=http://localhost:3000" > client/.env
```

`client/.env` 说明：

| 字段 | 说明 |
|------|------|
| `VITE_WS_URL` | Socket.io 服务端地址。**必须显式设置**，否则 Socket.io 客户端会回退到 `window.location.origin`（`:5173`），而 Vite 只代理 `/api`，不代理 WebSocket，导致协作通道无法建立。 |

## 4. 初始化数据库

### 方式一：使用 Prisma（推荐，需要 DIRECT_URL 可达）

```bash
cd server
npx prisma db push      # 将 schema 推送到数据库建表
npx prisma generate     # 生成 Prisma Client
```

> 执行 `prisma db push` / `prisma migrate` 时后端服务必须停止，否则 Prisma Client 文件被占用会报 EPERM 错误。

### 方式二：Supabase SQL 编辑器（当 5432 端口不可达时）

直接在 Supabase 控制台 → SQL Editor 执行以下建表语句，再本地运行 `npx prisma generate`：

```sql
CREATE TYPE "UserStatus" AS ENUM ('active', 'banned');
CREATE TYPE "ItemType" AS ENUM ('Whiteboard', 'Document');
CREATE TYPE "PermissionRole" AS ENUM ('owner', 'editor', 'viewer');

CREATE TABLE "User" (
  "user_id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "username" VARCHAR(32) UNIQUE NOT NULL,
  "email" VARCHAR(128) UNIQUE NOT NULL,
  "password_hash" VARCHAR(256) NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE "CollaborativeItem" (
  "item_id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "type" "ItemType" NOT NULL,
  "owner_id" TEXT NOT NULL REFERENCES "User"("user_id"),
  "title" VARCHAR(256) NOT NULL,
  "is_public" BOOLEAN NOT NULL DEFAULT false,
  "content_data" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE "Permission" (
  "permission_id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL REFERENCES "User"("user_id"),
  "item_id" TEXT NOT NULL REFERENCES "CollaborativeItem"("item_id") ON DELETE CASCADE,
  "role" "PermissionRole" NOT NULL,
  UNIQUE("user_id", "item_id")
);
CREATE TABLE "Version" (
  "version_id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "item_id" TEXT NOT NULL REFERENCES "CollaborativeItem"("item_id") ON DELETE CASCADE,
  "content_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE "Comment" (
  "comment_id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "item_id" TEXT NOT NULL REFERENCES "CollaborativeItem"("item_id") ON DELETE CASCADE,
  "author_id" TEXT NOT NULL REFERENCES "User"("user_id"),
  "parent_id" TEXT REFERENCES "Comment"("comment_id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "position" JSONB NOT NULL,
  "is_resolved" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW."updated_at" = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_item_updated_at BEFORE UPDATE ON "CollaborativeItem"
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## 5. 启动后端

```bash
cd server
npm run dev
# Server running on http://localhost:3000
```

验证：
```bash
curl http://localhost:3000/api/health
# {"code":0,"data":{"status":"ok","time":"..."},"message":"success"}
```

## 6. 启动前端

```bash
cd client
npm run dev
# 访问 http://localhost:5173
```

## 7. 开发目录说明

| 路径 | 说明 |
|------|------|
| `server/src/routes/` | 添加新路由在此注册 |
| `server/src/controllers/` | 控制器（处理 req/res） |
| `server/src/services/` | 业务逻辑层 |
| `server/src/socket/handlers.js` | 新增 Socket 事件在此注册 |
| `client/src/pages/` | 页面组件 |
| `client/src/api/` | 接口封装（参考 auth.api.js） |
| `client/src/store/` | Zustand 状态管理 |

---

## 示例：调用后端接口

```js
// client/src/api/board.api.js
import request from './request';

export function getBoard(id) {
  return request.get(`/boards/${id}`);
}

export function saveBoard(id, data) {
  return request.put(`/boards/${id}`, data);
}
```

在组件里使用：
```js
import { getBoard } from '../api/board.api';

useEffect(() => {
  getBoard(id).then((board) => {
    // board 直接就是业务数据，request.js 已自动解包
    setBoard(board);
  });
}, [id]);
```

---

## 示例：使用 useSocket

```js
import { useSocket } from '../socket/useSocket';
import { SOCKET_EVENTS } from '../utils/constants';

function BoardPage() {
  const { id } = useParams();
  const { connect, joinRoom, leaveRoom, emit, on, off } = useSocket();

  useEffect(() => {
    connect();
    joinRoom(id);

    function onDraw(data) {
      // 处理他人的绘制事件
    }
    on('board:draw', onDraw);

    return () => {
      off('board:draw', onDraw);  // 必须解绑，防止内存泄漏
      leaveRoom(id);
    };
  }, [id]);

  function handleLocalDraw(data) {
    emit('board:draw', data);  // 广播自己的操作
  }
}
```

---

## 示例：文档实时协作（C 模块参考）

文档协作复用 `useSocket`，在其上用 Yjs 做 CRDT 同步。组件层不直接操作 socket，
而是通过 `useDocCollaboration` 拿到 `ydoc` / `provider`，再交给 TipTap 编辑器：

```js
import { useDocCollaboration } from '../hooks/useDocCollaboration';
import DocEditor from '../components/DocEditor';
import { getDoc, updateDoc } from '../api/doc.api';
import { applyPersistedYjsState, encodeYjsState } from '../collab/yjsUtils';

function DocPage() {
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  // 创建 Y.Doc + Provider + 撤销管理器，并加入房间
  const { ydoc, provider, color, undoManager, onlineUsers } = useDocCollaboration(id, user);

  // 1) 打开文档：拉取元数据，用已存快照注水（只做一次）
  useEffect(() => {
    getDoc(id).then((doc) => applyPersistedYjsState(ydoc, doc.content_data?.yjs_state));
  }, [id, ydoc]);

  // 2) 编辑过程：实时同步由 Provider 自动走 doc:operation / doc:cursor，无需手动处理
  // 3) 持久化：防抖 / 离开 / 打快照时再落库
  const save = () => updateDoc(id, { content_data: { yjs_state: encodeYjsState(ydoc) } });

  return <DocEditor ydoc={ydoc} provider={provider} user={user} color={color} undoManager={undoManager} />;
}
```

要点：

- **实时编辑不调接口**，全部走 Socket 增量同步；`PUT /api/docs/:id` 只在保存/快照时调用。
- 评论 / 版本 / 成员等「侧边栏」数据走普通 HTTP（见 `client/src/api/doc.api.js`），
  变更后 emit `doc:sidebar-changed` 通知其他人静默刷新。
- 想新增一个文档协作 Socket 事件时：先在 `client/src/utils/constants.js` 的 `SOCKET_EVENTS`
  补常量，再在 `server/src/socket/handlers.js` 注册（务必先 `assertDocumentAccess` 校验权限）。
- **文档树实时同步**：文件夹/文档的增删改通过 `tree:*` Socket 事件实时同步，无需手动刷新。
  前端由 `useTreeSync`（`hooks/useTreeSync.js`）订阅事件、`treeStore`（`store/treeStore.js`）管理状态，
  `DocTree` 组件直接读取 store，不再维护本地 state。新增文件夹或移动文档后，协作者也会收到
  `tree:reload` 事件并自动更新树视图（包括看到对方的完整文件夹结构）。

---

## 开发期间绕过登录（D 的登录页尚未实现）

在 D 完成 `LoginPage.jsx` 之前，用以下方式直接进入受保护页面：

**第一步：PowerShell 登录拿 token**

```powershell
$res = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email":"你的邮箱","password":"你的密码"}'
Write-Host $res.data.accessToken
Write-Host $res.data.refreshToken
```

**第二步：浏览器 F12 → Console 注入（替换成上一步输出的值）**

```javascript
localStorage.setItem('collab_access_token', '粘贴accessToken')
localStorage.setItem('collab_refresh_token', '粘贴refreshToken')
localStorage.setItem('collab_user', JSON.stringify({
  user_id: "粘贴user_id",
  username: "你的用户名",
  email: "你的邮箱"
}))
```

执行后直接在地址栏输入目标页面地址（`/board/:id` 或 `/doc/:id`）即可，**无需刷新**。

---

## 常见问题

**Q：Redis 未配置，会影响启动吗？**
A：不会。后端已做容错降级，REDIS_URL 为空时会打印警告并以无缓存模式运行。

**Q：数据库连接失败怎么办？**
A：检查 `server/.env` 中的 `DATABASE_URL` 格式是否正确（postgresql://user:pass@host:port/db）。

**Q：前端页面跳转到 /login 怎么回事？**
A：D 的登录页尚未实现，需在浏览器控制台手动注入 token（见下方「开发期间绕过登录」）。

**Q：打开文档报「找不到 @tiptap/...」或编辑器空白？**
A：拉取 `feature/doc` 后没有在 `client` 重新 `npm install`。文档模块新增了 TipTap / Yjs 等依赖，需重装。

**Q：多人编辑同一文档没有实时同步？**
A：依次检查：① 两端都已登录且 token 有效（Socket 连接需鉴权）；② 后端已起且无 `doc:error`（多为权限不足，需 editor 及以上）；③ 顶部连接横幅是否为「已连接」。实时编辑走 Socket 不走 HTTP，刷新看不到对方改动通常是 Socket 未连上。

**Q：怎么测试文档协作？**
A：用两个浏览器（或一个无痕窗口）登录不同账号，owner 在「成员」面板把对方邀请为 `editor`，两边打开同一 `/doc/:id` 即可看到光标与内容实时同步。

**Q：协作者看不到我创建的文件夹？**
A：确认对方已被邀请为某文档的 `editor` 或 `viewer`——只要双方有共享文档关系，`GET /api/folders/tree` 就会返回对方的全部文件夹。实时同步依赖 Socket：确认顶部连接横幅显示「已连接」，且 `DocLeftSidebar` 已加载（即对方在 `/doc/:id` 页面内）。若对方刚进入页面、Socket 尚未连接，刷新页面后 REST 接口会直接返回完整树。
