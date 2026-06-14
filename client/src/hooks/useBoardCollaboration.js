import { useEffect, useState, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { SocketIoYjsProvider } from '../collab/socketIoYjsProvider';
import { colorFromUserId } from '../collab/userColor';
import { useSocket } from '../socket/useSocket';
import { SOCKET_EVENTS } from '../utils/constants';

export function useBoardCollaboration(itemId, user) {
  const { connect, joinRoom, leaveRoom, emit, on, off, connected, status } = useSocket();
  const [collab, setCollab] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const providerRef = useRef(null);
  const ydocRef = useRef(null);
  const joinedRef = useRef(false);

  const getYdoc = useCallback(() => ydocRef.current, []);

  useEffect(() => {
    if (!itemId || !user?.user_id) {
      setCollab(null);
      return undefined;
    }

    if (joinedRef.current) return undefined;

    connect();
    joinRoom(itemId);
    joinedRef.current = true;

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
    });

    providerRef.current = provider;

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
      joinedRef.current = false;
      leaveRoom(itemId);
      provider.awareness.off('change', syncOnlineUsers);
      provider.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      providerRef.current = null;
      setCollab(null);
      setOnlineUsers([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, user?.user_id]);

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