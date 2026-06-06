const prisma = require('../config/prisma');
const docService = require('../services/doc.service');
const boardService = require('../services/board.service');

/**
 * 为每个连接的 socket 注册基础事件处理器
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {{ joinRoom: Function, leaveRoom: Function, broadcastToRoom: Function }} utils
 */
function handlers(io, socket, { joinRoom, leaveRoom, broadcastToRoom }) {
  async function canAccessDoc(itemId, minRole) {
    try {
      await docService.assertDocumentAccess(itemId, socket.data.userId, minRole);
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
      await boardService.assertBoardReadable({ userId: socket.data.userId, itemId });
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

  // 白板 Yjs 增量同步（B）：多人无冲突合并
  socket.on('board:operation', async ({ itemId, update }) => {
    if (!itemId || !update) return;
    if (!(await canAccessBoard(itemId))) return;
    try {
      await boardService.assertBoardWritable({ userId: socket.data.userId, itemId });
    } catch (err) {
      socket.emit('board:error', {
        itemId,
        code: err.code || 40301,
        message: err.message || '白板无编辑权限',
      });
      return;
    }
    broadcastToRoom(
      itemId,
      'board:operation',
      { itemId, update, userId: socket.data.userId },
      socket.id
    );
  });

  // 新加入用户请求完整白板状态（由任意在线协作者响应）
  socket.on('board:sync-request', async ({ itemId }) => {
    if (!itemId) return;
    if (!inRoom(itemId)) return;
    if (!(await canAccessBoard(itemId))) return;
    broadcastToRoom(
      itemId,
      'board:sync-request',
      { itemId, requesterSocketId: socket.id, userId: socket.data.userId },
      socket.id
    );
  });

  // 某协作者响应完整白板状态：只发给目标 socket
  socket.on('board:sync-response', async ({ itemId, requesterSocketId, update }) => {
    if (!itemId || !requesterSocketId || !update) return;
    if (!inRoom(itemId)) return;
    if (!(await canAccessBoard(itemId))) return;
    io.to(requesterSocketId).emit('board:sync-response', {
      itemId,
      update,
      userId: socket.data.userId,
    });
  });

  // TODO: 文档同步事件由 C 在此处注册，参考 join/leave 模式
  // socket.on('doc:operation', handler)
  // socket.on('doc:cursor', handler)
}

module.exports = handlers;
