import { create } from 'zustand';
import { getFolderTree } from '../api/folder.api';

/**
 * 文档树全局状态 store。
 *
 * DocTree 组件从此 store 读取 folders / documents，而不再使用组件本地 useState。
 * useTreeSync hook 负责订阅 Socket 事件并调用此 store 的 apply* 方法做局部更新，
 * 从而避免每次操作都全量 reload。
 */
const useTreeStore = create((set, get) => ({
  folders: [],
  documents: [],
  loading: false,

  /** 全量加载文档树（初始化时调用一次） */
  fetchTree: async () => {
    set({ loading: true });
    try {
      const data = await getFolderTree();
      set({ folders: data.folders || [], documents: data.documents || [] });
    } catch {
      // request interceptor 已经弹出错误 toast，此处静默处理
    } finally {
      set({ loading: false });
    }
  },

  // ── 以下方法由 useTreeSync 响应 socket 事件调用，做最小粒度更新 ──────────

  /** 服务端广播：新增文件夹 */
  applyFolderCreated: (folder) =>
    set((s) => ({ folders: [...s.folders, folder] })),

  /** 服务端广播：文件夹重命名 / 移动 / 排序 */
  applyFolderUpdated: (folder) =>
    set((s) => ({
      folders: s.folders.map((f) => (f.folder_id === folder.folder_id ? { ...f, ...folder } : f)),
    })),

  /**
   * 服务端广播：文件夹被删除。
   * 子文件夹由服务端级联删除，客户端需同步过滤；其中的文档 folder_id 置为 null。
   */
  applyFolderDeleted: (folderId) => {
    const { folders } = get();

    // 收集被级联删除的所有后代文件夹 id（含自身）
    const deletedIds = new Set();
    function collectDescendants(id) {
      deletedIds.add(id);
      folders.forEach((f) => {
        if (f.parent_id === id) collectDescendants(f.folder_id);
      });
    }
    collectDescendants(folderId);

    set((s) => ({
      folders: s.folders.filter((f) => !deletedIds.has(f.folder_id)),
      documents: s.documents.map((d) =>
        deletedIds.has(d.folder_id) ? { ...d, folder_id: null } : d,
      ),
    }));
  },

  /** 服务端广播：文档被移动到某文件夹（folderId 为 null 表示移出文件夹） */
  applyDocMoved: ({ docId, folderId }) =>
    set((s) => ({
      documents: s.documents.map((d) =>
        d.item_id === docId ? { ...d, folder_id: folderId } : d,
      ),
    })),

  /** 服务端广播：新建文档 */
  applyDocCreated: (doc) =>
    set((s) => {
      // 避免因自己操作产生的广播导致重复追加
      if (s.documents.some((d) => d.item_id === doc.item_id)) return s;
      return { documents: [...s.documents, doc] };
    }),

  /** 服务端广播：文档被删除 */
  applyDocDeleted: (docId) =>
    set((s) => ({ documents: s.documents.filter((d) => d.item_id !== docId) })),

  // ── 乐观更新辅助 ──────────────────────────────────────────────────────────

  /** 返回当前 folders/documents 快照（用于拖拽失败时回滚） */
  snapshot: () => {
    const { folders, documents } = get();
    return { folders, documents };
  },

  /** 回滚到快照 */
  rollback: (snap) => set({ folders: snap.folders, documents: snap.documents }),
}));

export default useTreeStore;
