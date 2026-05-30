const { Server } = require('socket.io');
const { CLIENT_ORIGIN } = require('../config/env');
const { verifyToken } = require('../utils/jwt');
const handlers = require('./handlers');

let io;

/**
 * 初始化 Socket.io，挂到 HTTP server 上
 * @param {import('http').Server} httpServer
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: CLIENT_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // 连接鉴权中间件
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('未提供 token，连接被拒绝'));
    }
    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch (err) {
      next(new Error('token 无效，连接被拒绝'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket] 用户 ${socket.data.userId} 已连接，socketId: ${socket.id}`);

    handlers(io, socket, { joinRoom, leaveRoom });

    socket.on('disconnect', (reason) => {
      console.log(`[socket] 用户 ${socket.data.userId} 断开连接，原因: ${reason}`);
    });
  });

  console.log('[socket] Socket.io 已初始化');
  return io;
}

// ─── 通用房间工具方法（供组员在业务层调用）──────────────────────────────────

/**
 * 让 socket 加入某协作项目的房间，并广播「用户加入」事件
 * @param {import('socket.io').Socket} socket
 * @param {string} itemId
 */
function joinRoom(socket, itemId) {
  const room = `item:${itemId}`;
  socket.join(room);
  console.log(`[socket] 用户 ${socket.data.userId} 加入房间 ${room}`);
  // 通知房间内其他人
  socket.to(room).emit('user:joined', { userId: socket.data.userId, itemId });
}

/**
 * 让 socket 离开某协作项目的房间，并广播「用户离开」事件
 * @param {import('socket.io').Socket} socket
 * @param {string} itemId
 */
function leaveRoom(socket, itemId) {
  const room = `item:${itemId}`;
  socket.leave(room);
  console.log(`[socket] 用户 ${socket.data.userId} 离开房间 ${room}`);
  socket.to(room).emit('user:left', { userId: socket.data.userId, itemId });
}

/**
 * 向指定房间广播事件，可排除发送者自己
 * @param {string} itemId
 * @param {string} event
 * @param {*} data
 * @param {string} [exceptSocketId]
 */
function broadcastToRoom(itemId, event, data, exceptSocketId) {
  if (!io) throw new Error('Socket.io 尚未初始化');
  const room = `item:${itemId}`;
  if (exceptSocketId) {
    io.to(room).except(exceptSocketId).emit(event, data);
  } else {
    io.to(room).emit(event, data);
  }
}

module.exports = { initSocket, joinRoom, leaveRoom, broadcastToRoom };
