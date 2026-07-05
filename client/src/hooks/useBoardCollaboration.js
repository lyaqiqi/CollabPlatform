import { useEffect, useState, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { SocketIoYjsProvider } from '../collab/socketIoYjsProvider';
import { colorFromUserId } from '../collab/userColor';
import { useSocket } from '../socket/useSocket';
import { SOCKET_EVENTS } from '../utils/constants';

/**
 * 为白板页创建 Y.Doc + Socket.io Yjs Provider，并加入协作房间。
 * 与 useDocCollaboration 同构，区别仅在于：
 *  - 使用白板专属的 Yjs 事件名（board:yjs-update / board:yjs-cursor）
 *  - Y.Doc 的共享数据结构是 Array('objects') + Map('meta')，由 BoardPage 与 Fabric 画布双向绑定
 *
 * @param {string|undefined} itemId
 * @param {{ user_id: string, username: string }|null} user
 */
export function useBoardCollaboration(itemId, user) {
  const { connect, joinRoom, leaveRoom, emit, on, off, connected, status } = useSocket();
  const [collab, setCollab] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const ydocRef = useRef(null);

  const getYdoc = useCallback(() => ydocRef.current, []);

  useEffect(() => {
    if (!itemId || !user?.user_id) {
      setCollab(null);
      return undefined;
    }

    connect();

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const yObjects = ydoc.getArray('objects');
    const yMeta = ydoc.getMap('meta');
    const color = colorFromUserId(user.user_id);

    const provider = new SocketIoYjsProvider(ydoc, {
      itemId,
      user,
      color,
      emit,
      on,
      off,
      eventOperation: SOCKET_EVENTS.BOARD_YJS_UPDATE,
      eventCursor: SOCKET_EVENTS.BOARD_YJS_CURSOR,
      eventSyncRequest: SOCKET_EVENTS.BOARD_YJS_SYNC_REQUEST,
      eventSyncState: SOCKET_EVENTS.BOARD_YJS_SYNC_STATE,
    });

    // 断线重连后自动重新加入房间（否则 socket 虽已连接却不在房间内，收不到广播），
    // 并触发一次全量同步握手，补齐离线期间双方错过的更新。
    const handleConnect = () => {
      joinRoom(itemId);
      provider.requestSync();
    };

    on('connect', handleConnect);
    joinRoom(itemId);
    // 首次加入：向房间内已在线的成员请求全量状态（迟到者据此补齐已有内容）。
    provider.requestSync();

    // 实时在线用户：从 Awareness 状态派生，按 user.id 去重（同一用户多标签只算一人）。
    const syncOnlineUsers = () => {
      const states = provider.awareness.getStates();
      const byUser = new Map();
      states.forEach((state, clientId) => {
        if (!state?.user) return;
        const key = state.user.id ?? state.user.name ?? clientId;
        const isSelf = clientId === ydoc.clientID;
        const existing = byUser.get(key);
        if (!existing) {
          byUser.set(key, { ...state.user, isSelf });
        } else if (isSelf) {
          byUser.set(key, { ...existing, isSelf: true });
        }
      });
      setOnlineUsers(Array.from(byUser.values()));
    };

    provider.awareness.on('change', syncOnlineUsers);
    syncOnlineUsers();

    setCollab({ ydoc, provider, color, yObjects, yMeta });

    return () => {
      off('connect', handleConnect);
      leaveRoom(itemId);
      provider.awareness.off('change', syncOnlineUsers);
      provider.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      setCollab(null);
      setOnlineUsers([]);
    };
  }, [itemId, user?.user_id, user?.username, connect, joinRoom, leaveRoom, emit, on, off]);

  return {
    ...collab,
    connected,
    status,
    onlineUsers,
    getYdoc,
    socketEmit: emit,
    socketOn: on,
    socketOff: off,
  };
}
