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
# 编辑 server/.env，填入真实的 DATABASE_URL、JWT_SECRET 等

# 前端
cp client/.env.example client/.env
# 一般不需要修改，默认指向本地 3000 端口
```

## 4. 初始化数据库

> 人工填好 `server/.env` 中的 `DATABASE_URL` 后执行：

```bash
cd server
npm run prisma:migrate   # 运行 prisma migrate dev，建表（含文档评论回复用的 parent_id 迁移）
npm run prisma:generate  # 生成 Prisma Client（首次必须执行）
```

> 文档模块新增了 `Comment.parent_id`（评论回复自关联）迁移。拉取 `feature/doc` 后若提示
> schema 与数据库不一致，重新执行 `npm run prisma:migrate` 应用最新迁移即可。

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

---

## 常见问题

**Q：Redis 未配置，会影响启动吗？**
A：不会。后端已做容错降级，REDIS_URL 为空时会打印警告并以无缓存模式运行。

**Q：数据库连接失败怎么办？**
A：检查 `server/.env` 中的 `DATABASE_URL` 格式是否正确（postgresql://user:pass@host:port/db）。

**Q：前端页面跳转到 /login 怎么回事？**
A：localStorage 中没有有效 token，需要先登录。开发时可在浏览器控制台手动设置 token 测试受保护页面。

**Q：打开文档报「找不到 @tiptap/...」或编辑器空白？**
A：拉取 `feature/doc` 后没有在 `client` 重新 `npm install`。文档模块新增了 TipTap / Yjs 等依赖，需重装。

**Q：多人编辑同一文档没有实时同步？**
A：依次检查：① 两端都已登录且 token 有效（Socket 连接需鉴权）；② 后端已起且无 `doc:error`（多为权限不足，需 editor 及以上）；③ 顶部连接横幅是否为「已连接」。实时编辑走 Socket 不走 HTTP，刷新看不到对方改动通常是 Socket 未连上。

**Q：怎么测试文档协作？**
A：用两个浏览器（或一个无痕窗口）登录不同账号，owner 在「成员」面板把对方邀请为 `editor`，两边打开同一 `/doc/:id` 即可看到光标与内容实时同步。
