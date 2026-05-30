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
npm run prisma:migrate   # 运行 prisma migrate dev，建表
npm run prisma:generate  # 生成 Prisma Client（首次必须执行）
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

## 常见问题

**Q：Redis 未配置，会影响启动吗？**
A：不会。后端已做容错降级，REDIS_URL 为空时会打印警告并以无缓存模式运行。

**Q：数据库连接失败怎么办？**
A：检查 `server/.env` 中的 `DATABASE_URL` 格式是否正确（postgresql://user:pass@host:port/db）。

**Q：前端页面跳转到 /login 怎么回事？**
A：localStorage 中没有有效 token，需要先登录。开发时可在浏览器控制台手动设置 token 测试受保护页面。
