/**
 * 为每个连接的 socket 注册基础事件处理器
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {{ joinRoom: Function, leaveRoom: Function }} utils
 */
function handlers(io, socket, { joinRoom, leaveRoom }) {
  // 加入协作项目房间
  socket.on('join', ({ itemId }) => {
    if (!itemId) return;
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

  // TODO: 文档同步事件由 C 在此处注册，参考 join/leave 模式
  // socket.on('doc:operation', handler)
  // socket.on('doc:cursor', handler)
}

module.exports = handlers;
