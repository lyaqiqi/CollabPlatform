import { useEffect, useRef } from 'react';
import { useSocket } from '../socket/useSocket';
import { SOCKET_EVENTS } from '../utils/constants';
import useTreeStore from '../store/treeStore';

/**
 * 订阅服务端推送的文档树变更事件，并将变更同步到 treeStore。
 *
 * 使用方式：在页面顶层（如 DocShell 或 HomePage）调用一次即可，
 * 不需要在每个操作按钮里手动 reload()。
 *
 * Socket 连接建立后会：
 *   1. 发送 tree:subscribe 加入本用户的 tree:{userId} 房间
 *   2. 监听 tree:folder-created / tree:folder-updated / tree:folder-deleted
 *      tree:doc-created / tree:doc-moved / tree:doc-deleted
 *      tree:reload — 跨用户协作时由服务端触发，执行全量 fetchTree()
 *   3. 组件卸载时取消订阅并解绑事件
 */
export function useTreeSync() {
  const { emit, on, off, connected } = useSocket();
  const store = useTreeStore();

  // 用 ref 持有各 handler 引用，确保 off 能精确匹配同一个函数实例
  const handlersRef = useRef(null);

  // 初次加载
  useEffect(() => {
    store.fetchTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // socket 连接就绪后订阅房间 + 绑定事件
  useEffect(() => {
    if (!connected) return;

    emit(SOCKET_EVENTS.TREE_SUBSCRIBE);

    const handlers = {
      // 同用户多标签页：细粒度增量更新
      [SOCKET_EVENTS.TREE_FOLDER_CREATED]: ({ folder }) => store.applyFolderCreated(folder),
      [SOCKET_EVENTS.TREE_FOLDER_UPDATED]: ({ folder }) => store.applyFolderUpdated(folder),
      [SOCKET_EVENTS.TREE_FOLDER_DELETED]: ({ folderId }) => store.applyFolderDeleted(folderId),
      [SOCKET_EVENTS.TREE_DOC_CREATED]:    ({ doc })     => store.applyDocCreated(doc),
      [SOCKET_EVENTS.TREE_DOC_MOVED]:      (payload)     => store.applyDocMoved(payload),
      [SOCKET_EVENTS.TREE_DOC_DELETED]:    ({ docId })   => store.applyDocDeleted(docId),
      // 跨用户协作：全量重新拉取（文档被其他用户移入/移出文件夹，或文件夹被重命名/删除）
      [SOCKET_EVENTS.TREE_RELOAD]:         ()            => store.fetchTree(),
    };

    handlersRef.current = handlers;
    Object.entries(handlers).forEach(([event, handler]) => on(event, handler));

    return () => {
      emit(SOCKET_EVENTS.TREE_UNSUBSCRIBE);
      const saved = handlersRef.current;
      if (saved) {
        Object.entries(saved).forEach(([event, handler]) => off(event, handler));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);
}

export default useTreeSync;
