import { io } from 'socket.io-client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SOCKET_EVENTS } from '../utils/constants';

const WS_URL = import.meta.env.VITE_WS_URL || window.location.origin;

// 连接状态枚举
export const SocketStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  RECOVERED: 'recovered',
};

// 单例 socket 实例（跨组件共享同一条连接）
let socketInstance = null;

/**
 * WebSocket 客户端封装 Hook。
 * B（白板）和 C（文档）直接调用此 hook，不需要直接操作 socket.io-client。
 *
 * 用法示例（BoardPage / DocPage）：
 *   const { connect, joinRoom, emit, on, off, status } = useSocket();
 *   useEffect(() => {
 *     connect();
 *     joinRoom(itemId);
 *     on('board:draw', handleDraw);
 *     return () => { off('board:draw', handleDraw); leaveRoom(itemId); };
 *   }, [itemId]);
 */
export function useSocket() {
  const [status, setStatus] = useState(
    socketInstance?.connected ? SocketStatus.CONNECTED : SocketStatus.DISCONNECTED
  );
  // 用 ref 保存 socket，避免 re-render 时引用变化
  const socketRef = useRef(socketInstance);

  const recoverHandlerRef = useRef(null);

  const updateStatus = useCallback((newStatus) => {
    setStatus(newStatus);
  }, []);

  const setOnRecovered = useCallback((handler) => {
    recoverHandlerRef.current = handler;
  }, []);

  // 注册/注销连接状态监听（每次 hook 实例化时挂到共享 socket）
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onConnect = () => updateStatus(SocketStatus.CONNECTED);
    const onDisconnect = () => updateStatus(SocketStatus.DISCONNECTED);

    const onReconnectAttempt = () => updateStatus(SocketStatus.RECONNECTING);
    const onReconnect = () => {
      updateStatus(SocketStatus.RECOVERED);
      if (recoverHandlerRef.current) {
        recoverHandlerRef.current();
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('reconnect', onReconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('reconnect_attempt', onReconnectAttempt);
      socket.off('reconnect', onReconnect);
    };
  }, [updateStatus]);

  /** 建立连接（幂等：已有实例时不重复创建） */
  const connect = useCallback(() => {
    const token = localStorage.getItem('collab_access_token');
    if (!token) {
      console.warn('[socket] 未登录，无法建立 WebSocket 连接');
      return;
    }

    // 关键：连接中/已连接都直接复用，避免重复 new io() 造成连接风暴
    if (socketInstance) return;

    socketInstance = io(WS_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket'],
    });

    socketRef.current = socketInstance;
    setStatus(SocketStatus.CONNECTING);

    socketInstance.on('connect', () => {
      console.log('[socket] 已连接，id:', socketInstance.id);
      updateStatus(SocketStatus.CONNECTED);
    });
    socketInstance.on('disconnect', (reason) => {
      console.log('[socket] 断开连接:', reason);
      updateStatus(SocketStatus.DISCONNECTED);
    });
    socketInstance.io.on('reconnect_attempt', () => {
      console.log('[socket] 重连中...');
      updateStatus(SocketStatus.RECONNECTING);
    });
    socketInstance.io.on('reconnect', () => {
      console.log('[socket] 重连成功');
      updateStatus(SocketStatus.RECOVERED);
    });
    socketInstance.on('connect_error', (err) => {
      console.error('[socket] 连接错误:', err.message);
    });
  }, [updateStatus]);

  /** 主动断开连接 */
  const disconnect = useCallback(() => {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
      socketRef.current = null;
      setStatus(SocketStatus.DISCONNECTED);
    }
  }, []);

  /** 发送事件 */
  const emit = useCallback((event, data) => {
    if (!socketRef.current?.connected) {
      console.warn('[socket] 未连接，emit 被忽略:', event);
      return;
    }
    socketRef.current.emit(event, data);
  }, []);

  /** 监听事件（注意在组件卸载时调用 off 解绑，避免内存泄漏） */
  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
  }, []);

  /** 取消监听 */
  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  /** 加入协作项目房间 */
  const joinRoom = useCallback((itemId) => {
    emit(SOCKET_EVENTS.JOIN, { itemId });
  }, [emit]);

  /** 离开协作项目房间 */
  const leaveRoom = useCallback((itemId) => {
    emit(SOCKET_EVENTS.LEAVE, { itemId });
  }, [emit]);

  /**
   * ping/pong 自测（联调用）
   * @returns {Promise<number>} pong 返回的时间戳
   */
  const ping = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        return reject(new Error('未连接'));
      }
      const timeout = setTimeout(() => reject(new Error('ping 超时')), 5000);
      socketRef.current.once(SOCKET_EVENTS.PONG, ({ time }) => {
        clearTimeout(timeout);
        resolve(time);
      });
      socketRef.current.emit(SOCKET_EVENTS.PING);
    });
  }, []);

  return {
    status,
    connectionState: status,
    initialized: Boolean(socketInstance),
    connected: status === SocketStatus.CONNECTED || status === SocketStatus.RECOVERED,
    connect,
    disconnect,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom,
    ping,
    setOnRecovered,
  };
}

export default useSocket;
