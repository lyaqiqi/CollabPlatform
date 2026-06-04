const docService = require('../services/doc.service');

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

  // 加入协作项目房间
  socket.on('join', async ({ itemId }) => {
    if (!itemId) return;
    if (!(await canAccessDoc(itemId, 'viewer'))) return;
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

  // TODO: 白板同步事件由 B 在此处注册，参考 join/leave 模式
  // socket.on('board:draw', handler)
  // socket.on('board:clear', handler)
}

module.exports = handlers;
