const prisma = require('../config/prisma');
const docService = require('../services/doc.service');
const boardService = require('../services/board.service');
const AppError = require('../utils/AppError');

/**
 * 为每个连接的 socket 注册基础事件处理器
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {{ joinRoom: Function, leaveRoom: Function, broadcastToRoom: Function }} utils
 */
function handlers(io, socket, { joinRoom, leaveRoom, broadcastToRoom }) {
  // 每个 socket 缓存自己已通过的权限判定，避免每条实时消息（光标/增量）都查库。
  // 高频协作（如拖动、光标移动可达 20 次/秒）若每次都查库，会瞬间打满数据库连接池，
  // 尤其是远程库（Supabase）。这里只缓存“通过”的结果，且有 TTL，权限变更最多延迟 TTL 生效。
  const ACCESS_TTL_MS = 15000;
  // key -> { freshUntil: number, everGranted: boolean }
  const accessCache = new Map();

  // 判断错误是否为“业务层明确拒绝”（无权限 / 资源不存在），
  // 以区别于数据库不可达、超时等基础设施故障。
  function isDefiniteDeny(err) {
    return (
      err instanceof AppError &&
      (err.code === AppError.CODES.FORBIDDEN || err.code === AppError.CODES.NOT_FOUND)
    );
  }

  async function checkAccessCached(key, assertFn) {
    const now = Date.now();
    const entry = accessCache.get(key);
    if (entry && entry.freshUntil > now) return; // 新鲜授权，直接放行，不查库

    try {
      await assertFn();
      accessCache.set(key, { freshUntil: now + ACCESS_TTL_MS, everGranted: true });
    } catch (err) {
      if (isDefiniteDeny(err)) {
        // 真正的无权限：撤销缓存并拒绝
        accessCache.delete(key);
        throw err;
      }
      // 基础设施故障（数据库不可达/超时等）：不要因抖动误伤实时协作。
      // 若此前曾成功授权过该用户，则沿用旧授权并续一小段宽限期，
      // 避免慢查询/断连期间把合法编辑者的每一笔绘制都当成“无权限”丢弃。
      if (entry && entry.everGranted) {
        accessCache.set(key, { freshUntil: now + ACCESS_TTL_MS, everGranted: true });
        console.warn(
          `[socket] 权限校验遇到基础设施错误，沿用上次授权 key=${key} err=${err?.message || err}`
        );
        return;
      }
      // 从未授权过的用户遇到基础设施错误：保持保守，拒绝
      throw err;
    }
  }

  async function canAccessDoc(itemId, minRole) {
    try {
      await checkAccessCached(`doc:${minRole}:${itemId}`, () =>
        docService.assertDocumentAccess(itemId, socket.data.userId, minRole)
      );
      return true;
    } catch (err) {
      socket.emit('doc:error', {
        itemId,
        code: err.code || 40301,
        message: err.message || '文档权限校验失败',
      });
      return false;
    }
  }

  async function canAccessBoard(itemId) {
    try {
      await checkAccessCached(`board:read:${itemId}`, () =>
        boardService.assertBoardReadable({ userId: socket.data.userId, itemId })
      );
      return true;
    } catch (err) {
      socket.emit('board:error', {
        itemId,
        code: err.code || 40301,
        message: err.message || '白板权限校验失败',
      });
      return false;
    }
  }

  async function canWriteBoard(itemId) {
    try {
      await checkAccessCached(`board:write:${itemId}`, () =>
        boardService.assertBoardWritable({ userId: socket.data.userId, itemId })
      );
      return true;
    } catch (err) {
      socket.emit('board:error', {
        itemId,
        code: err.code || 40301,
        message: err.message || '无权限编辑该白板',
      });
      return false;
    }
  }

  // 加入协作项目房间：先查 item 类型，再走对应权限校验
  socket.on('join', async ({ itemId }) => {
    if (!itemId) return;
    let item;
    try {
      item = await prisma.collaborativeItem.findUnique({
        where: { item_id: itemId },
        select: { type: true },
      });
    } catch { return; }
    if (!item) return;

    if (item.type === 'Document') {
      if (!(await canAccessDoc(itemId, 'viewer'))) return;
    } else if (item.type === 'Whiteboard') {
      if (!(await canAccessBoard(itemId))) return;
    }
    joinRoom(socket, itemId);
  });

  // 离开协作项目房间
  socket.on('leave', ({ itemId }) => {
    if (!itemId) return;
    leaveRoom(socket, itemId);
  });

  // ping/pong — 用于联调验证连接是否正常
  socket.on('ping', () => {
    socket.emit('pong', { time: Date.now() });
  });

  // 文档 Yjs 增量同步（C）
  socket.on('doc:operation', async ({ itemId, update }) => {
    if (!itemId || !update) return;
    if (!(await canAccessDoc(itemId, 'editor'))) return;
    broadcastToRoom(
      itemId,
      'doc:operation',
      { itemId, update, userId: socket.data.userId },
      socket.id
    );
  });

  // 文档协作光标 / Awareness（C）
  socket.on('doc:cursor', async ({ itemId, update }) => {
    if (!itemId || !update) return;
    if (!(await canAccessDoc(itemId, 'viewer'))) return;
    broadcastToRoom(
      itemId,
      'doc:cursor',
      { itemId, update, userId: socket.data.userId },
      socket.id
    );
  });

  // 文档标题变更同步（C）：广播给房间内其他人
  socket.on('doc:title-changed', async ({ itemId, title }) => {
    if (!itemId || typeof title !== 'string') return;
    if (!(await canAccessDoc(itemId, 'editor'))) return;
    broadcastToRoom(itemId, 'doc:title-changed', { itemId, title }, socket.id);
  });

  // 侧边栏变更通知（C）：评论/版本有更新，通知其他人刷新侧边栏
  socket.on('doc:sidebar-changed', async ({ itemId }) => {
    if (!itemId) return;
    if (!(await canAccessDoc(itemId, 'viewer'))) return;
    broadcastToRoom(itemId, 'doc:sidebar-changed', { itemId }, socket.id);
  });

  // ==================== 白板 Yjs 增量同步（新增）====================
  socket.on('board:yjs-update', async ({ itemId, update }) => {
    if (!itemId || !update) return;
    // 需要 editor 权限才能修改白板（writable 已蕴含 readable），走带缓存的校验
    if (!(await canWriteBoard(itemId))) {
      console.log(
        `[board] yjs-update 被拒绝（无写权限）user=${socket.data.userId} item=${itemId}`
      );
      return;
    }
    console.log(
      `[board] yjs-update 广播 user=${socket.data.userId} item=${itemId} bytes=${update.length}`
    );
    broadcastToRoom(
      itemId,
      'board:yjs-update',
      { itemId, update, userId: socket.data.userId },
      socket.id
    );
  });

  // 白板同步握手（新增）——分两个方向：
  // 1) sync-request：客户端加入/重连时请求房间内其他人补发全量状态。
  //    只需读权限即可发起（viewer 也要能拉取到当前画布内容）。
  socket.on('board:yjs-sync-request', async ({ itemId }) => {
    if (!itemId) return;
    if (!(await canAccessBoard(itemId))) return;
    broadcastToRoom(
      itemId,
      'board:yjs-sync-request',
      { itemId, userId: socket.data.userId },
      socket.id
    );
  });

  // 2) sync-state：携带全量状态的补发，会被对端合并进文档，等同于“写入”，
  //    因此需要写权限。与实时增量不同的是：这是加入/重连时的自动握手，
  //    读者（viewer）也会触发一次，故校验失败时【静默丢弃、不回报 board:error】，
  //    避免 viewer 一进白板就弹“无权限编辑”。
  socket.on('board:yjs-sync-state', async ({ itemId, update }) => {
    if (!itemId || !update) return;
    try {
      // 复用与实时增量相同的缓存键，避免重连时反复查库
      await checkAccessCached(`board:write:${itemId}`, () =>
        boardService.assertBoardWritable({ userId: socket.data.userId, itemId })
      );
    } catch {
      return; // 无写权限：静默忽略，不广播、不报错
    }
    broadcastToRoom(
      itemId,
      'board:yjs-sync-state',
      { itemId, update, userId: socket.data.userId },
      socket.id
    );
  });

  // 白板协作光标 / Awareness（新增）
  socket.on('board:yjs-cursor', async ({ itemId, update }) => {
    if (!itemId || !update) return;
    if (!(await canAccessBoard(itemId))) return;
    broadcastToRoom(
      itemId,
      'board:yjs-cursor',
      { itemId, update, userId: socket.data.userId },
      socket.id
    );
  });

  // ==================== 旧白板事件（保留兼容，可选移除）====================
  const inRoom = (itemId) => socket.rooms.has(`item:${itemId}`);

  socket.on('board:draw', ({ itemId, ...payload }) => {
    if (!itemId) return;
    if (!inRoom(itemId)) return;
    socket.to(`item:${itemId}`).emit('board:draw', { itemId, userId: socket.data.userId, ...payload });
  });

  socket.on('board:sync', ({ itemId, canvas }) => {
    if (!itemId) return;
    if (!inRoom(itemId)) return;
    if (!canvas) return;
    socket.to(`item:${itemId}`).emit('board:sync', { itemId, userId: socket.data.userId, canvas });
  });

  socket.on('board:cursor', ({ itemId, x, y }) => {
    if (!itemId) return;
    if (!inRoom(itemId)) return;
    if (typeof x !== 'number' || typeof y !== 'number') return;
    socket.to(`item:${itemId}`).emit('board:cursor', { itemId, userId: socket.data.userId, x, y });
  });

  // 订阅文档树变更房间：用户登录后调用一次，服务端的文件夹/文档增删改后会推送 tree:* 事件
  socket.on('tree:subscribe', () => {
    const userId = socket.data.userId;
    socket.join(`tree:${userId}`);
    console.log(`[socket] 用户 ${userId} 订阅文档树房间 tree:${userId}`);
  });

  socket.on('tree:unsubscribe', () => {
    const userId = socket.data.userId;
    socket.leave(`tree:${userId}`);
    console.log(`[socket] 用户 ${userId} 取消订阅文档树房间 tree:${userId}`);
  });
}

module.exports = handlers;