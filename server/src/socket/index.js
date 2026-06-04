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

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('未提供 token，连接被拒绝'));
    }
    try {
      const payload = verifyToken(token, 'access');
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

function joinRoom(socket, itemId) {
  const room = `item:${itemId}`;
  socket.join(room);
  console.log(`[socket] 用户 ${socket.data.userId} 加入房间 ${room}`);
  socket.to(room).emit('user:joined', { userId: socket.data.userId, itemId });
}

function leaveRoom(socket, itemId) {
  const room = `item:${itemId}`;
  socket.leave(room);
  console.log(`[socket] 用户 ${socket.data.userId} 离开房间 ${room}`);
  socket.to(room).emit('user:left', { userId: socket.data.userId, itemId });
}

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
