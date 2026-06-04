import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { SocketIoYjsProvider } from '../collab/socketIoYjsProvider';
import { colorFromUserId } from '../collab/userColor';
import { useSocket } from '../socket/useSocket';

/**
 * 为文档页创建 Y.Doc + Socket.io Yjs Provider，并加入协作房间。
 * 同时暴露：
 *  - undoManager: Y.UndoManager（协作安全的撤销/重做）
 *  - onlineUsers: 通过 Awareness 实时派生的当前在线用户列表
 *
 * @param {string|undefined} itemId
 * @param {{ user_id: string, username: string }|null} user
 */
export function useDocCollaboration(itemId, user) {
  const { connect, joinRoom, leaveRoom, emit, on, off, connected } = useSocket();
  const [collab, setCollab] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!itemId || !user?.user_id) return undefined;

    const handleConnect = () => {
      joinRoom(itemId);
    };

    connect();
    on('connect', handleConnect);
    joinRoom(itemId);

    const ydoc = new Y.Doc();
    const color = colorFromUserId(user.user_id);
    const provider = new SocketIoYjsProvider(ydoc, {
      itemId,
      user,
      color,
      emit,
      on,
      off,
    });

    // 协作撤销/重做：跟踪 TipTap 写入 ydoc 的默认 XmlFragment
    const undoManager = new Y.UndoManager(ydoc.get('default', Y.XmlFragment));

    // 实时在线用户：从 Awareness 状态派生。
    // 同一用户可能因刷新/多标签存在多条 clientID 记录（旧记录会在超时后清除），
    // 这里按 user.id 去重，避免界面把同一个人显示成“新增的用户”。
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
          // 优先保留“自己”的标记
          byUser.set(key, { ...existing, isSelf: true });
        }
      });
      setOnlineUsers(Array.from(byUser.values()));
    };

    provider.awareness.on('change', syncOnlineUsers);
    syncOnlineUsers();

    setCollab({ ydoc, provider, color, undoManager });

    return () => {
      off('connect', handleConnect);
      leaveRoom(itemId);
      provider.awareness.off('change', syncOnlineUsers);
      provider.destroy();
      undoManager.destroy();
      ydoc.destroy();
      setCollab(null);
      setOnlineUsers([]);
    };
  }, [itemId, user?.user_id, user?.username, connect, joinRoom, leaveRoom, emit, on, off]);

  // 将已正确初始化的 socket emit/on/off 一并暴露，
  // 供调用方（DocPage）直接使用，避免重复调用 useSocket() 导致 socketRef 未同步的问题。
  return { ...collab, connected, onlineUsers, socketEmit: emit, socketOn: on, socketOff: off };
}
