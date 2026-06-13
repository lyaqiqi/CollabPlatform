import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tree, Dropdown, Modal, Input, Spin, Tooltip } from 'antd';
import {
  FileTextOutlined,
  FolderOutlined,
  FolderAddOutlined,
  FileAddOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import Toast from '../Toast';
import ConfirmDialog from '../ConfirmDialog';
import {
  createFolder,
  updateFolder,
  deleteFolder,
  moveDocToFolder,
} from '../../api/folder.api';
import { createDoc } from '../../api/doc.api';
import useAuthStore from '../../store/authStore';
import useTreeStore from '../../store/treeStore';

// ── localStorage helpers ─────────────────────────────────────────────────────

function loadExpanded(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveExpanded(key, keys) {
  try {
    localStorage.setItem(key, JSON.stringify(keys));
  } catch {
    // ignore storage quota errors
  }
}

// ── tree helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the children array of the folder identified by folderId in treeData.
 * Pass folderId=null to get root-level nodes.
 */
function getFolderChildren(treeData, folderId) {
  if (!folderId) return treeData;
  function search(nodes) {
    for (const node of nodes) {
      if (node.nodeType === 'folder' && node.refId === folderId) {
        return node.children || [];
      }
      if (node.children) {
        const found = search(node.children);
        if (found !== null) return found;
      }
    }
    return null;
  }
  return search(treeData) ?? [];
}

/**
 * Assembles the antd Tree data from flat { folders, documents }.
 * folder key = `folder:<id>`, doc key = `doc:<id>`.
 * Empty folders get a disabled placeholder child so the expand arrow is not misleading.
 */
function buildTreeData(folders, documents) {
  const childFoldersByParent = new Map();
  folders.forEach((folder) => {
    const list = childFoldersByParent.get(folder.parent_id) || [];
    list.push(folder);
    childFoldersByParent.set(folder.parent_id, list);
  });

  const docsByFolder = new Map();
  documents.forEach((doc) => {
    const list = docsByFolder.get(doc.folder_id) || [];
    list.push(doc);
    docsByFolder.set(doc.folder_id, list);
  });

  function buildDocNode(doc) {
    return {
      key: `doc:${doc.item_id}`,
      title: doc.title || '未命名文档',
      isLeaf: true,
      nodeType: 'doc',
      refId: doc.item_id,
      parentFolderId: doc.folder_id ?? null,
      shared: doc.shared,
    };
  }

  function buildFolderNode(folder) {
    const subFolders = (childFoldersByParent.get(folder.folder_id) || []).map(buildFolderNode);
    const docNodes = (docsByFolder.get(folder.folder_id) || []).map(buildDocNode);
    const children =
      subFolders.length === 0 && docNodes.length === 0
        ? [
            {
              key: `empty:${folder.folder_id}`,
              title: '空文件夹',
              isLeaf: true,
              disabled: true,
              nodeType: 'placeholder',
            },
          ]
        : [...subFolders, ...docNodes];
    return {
      key: `folder:${folder.folder_id}`,
      title: folder.name,
      isLeaf: false,
      nodeType: 'folder',
      refId: folder.folder_id,
      parentFolderId: folder.parent_id ?? null,
      readonly: Boolean(folder.readonly),   // 外部共享文件夹，不允许重命名/删除
      shared: Boolean(folder.shared),
      children,
    };
  }

  const rootFolders = (childFoldersByParent.get(null) || []).map(buildFolderNode);
  const rootDocs = (docsByFolder.get(null) || []).map(buildDocNode);
  return [...rootFolders, ...rootDocs];
}

// ── component ────────────────────────────────────────────────────────────────

export default function DocTree({ currentDocId, onSelectDoc }) {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.user_id);

  // Per-user localStorage key — prevents shared expanded state across accounts
  const expandedStorageKey = userId ? `doc-tree:expanded:${userId}` : 'doc-tree:expanded';

  // 从全局 store 读取树状态，由 useTreeSync（在父组件调用）保持实时同步
  const folders = useTreeStore((s) => s.folders);
  const documents = useTreeStore((s) => s.documents);
  const loading = useTreeStore((s) => s.loading);
  const {
    applyFolderCreated,
    applyDocCreated,
    applyDocMoved,
    applyFolderUpdated,
    snapshot,
    rollback,
  } = useTreeStore();

  const [expandedKeys, setExpandedKeys] = useState(() => loadExpanded(expandedStorageKey));
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const treeData = useMemo(() => buildTreeData(folders, documents), [folders, documents]);

  const handleExpand = useCallback(
    (keys) => {
      setExpandedKeys(keys);
      saveExpanded(expandedStorageKey, keys);
    },
    [expandedStorageKey],
  );

  // ── folder operations ──────────────────────────────────────────────────────

  async function handleCreateFolder(parentId) {
    try {
      const folder = await createFolder({ name: '新建文件夹', parent_id: parentId || null });
      // 乐观追加到 store（广播事件到达时 applyFolderCreated 会去重）
      applyFolderCreated(folder);
      if (parentId) {
        setExpandedKeys((prev) =>
          prev.includes(`folder:${parentId}`) ? prev : [...prev, `folder:${parentId}`],
        );
      }
      setRenameTarget({ type: 'folder', id: folder.folder_id });
      setRenameValue(folder.name);
    } catch {
      // already shown
    }
  }

  function openRename(node) {
    setRenameTarget({ type: 'folder', id: node.refId });
    setRenameValue(node.title);
  }

  async function submitRename() {
    const name = renameValue.trim();
    if (!name) {
      Toast.error('名称不能为空');
      return;
    }
    try {
      await updateFolder(renameTarget.id, { name });
      // store 更新由服务端广播 tree:folder-updated 触发
      setRenameTarget(null);
    } catch {
      // already shown
    }
  }

  function handleDeleteFolder(node) {
    ConfirmDialog.show({
      title: `删除文件夹「${node.title}」？`,
      content: '子文件夹会一并删除，其中的文档不会被删除，将退回到未分类。',
      okText: '确认删除',
      onOk: async () => {
        try {
          await deleteFolder(node.refId);
          // store 更新由服务端广播 tree:folder-deleted 触发
        } catch {
          // already shown
        }
      },
    });
  }

  // ── doc operations ─────────────────────────────────────────────────────────

  /** Create a new doc and immediately place it inside the given folder. */
  async function handleCreateDocInFolder(folderId) {
    try {
      const doc = await createDoc({ title: '未命名文档' });
      await moveDocToFolder(doc.item_id, folderId);
      // 乐观追加到 store（广播事件会去重）
      applyDocCreated({ ...doc, folder_id: folderId });
      setExpandedKeys((prev) =>
        prev.includes(`folder:${folderId}`) ? prev : [...prev, `folder:${folderId}`],
      );
      navigate(`/doc/${doc.item_id}`);
    } catch {
      // already shown
    }
  }

  async function handleMoveDocOut(node) {
    try {
      await moveDocToFolder(node.refId, null);
      // store 更新由服务端广播 tree:doc-moved 触发
    } catch {
      // already shown
    }
  }

  async function handleMoveDocToFolder(node, folderId) {
    try {
      await moveDocToFolder(node.refId, folderId);
      // store 更新由服务端广播 tree:doc-moved 触发
    } catch {
      // already shown
    }
  }

  // ── drag-drop ──────────────────────────────────────────────────────────────

  async function handleDrop(info) {
    const { dragNode, node: dropNode, dropToGap } = info;

    // Ignore drops onto placeholder nodes or readonly (shared) folders
    if (dropNode.nodeType === 'placeholder') return;
    if (dropNode.readonly) return;

    // Determine target folder
    let targetFolderId = null;
    if (!dropToGap && dropNode.nodeType === 'folder') {
      targetFolderId = dropNode.refId;
    } else {
      targetFolderId = dropNode.parentFolderId ?? null;
    }

    // No-op guards
    if (dragNode.nodeType === 'doc' && (dragNode.parentFolderId ?? null) === targetFolderId) return;
    if (dragNode.nodeType === 'folder' && dragNode.refId === targetFolderId) return;

    // Snapshot for rollback on error
    const prevSnapshot = snapshot();

    // ── Compute new sibling order and sort_order values (folders only) ──────
    const currentSiblings = getFolderChildren(treeData, targetFolderId);
    const dropNodeOrigIdx = currentSiblings.findIndex((s) => s.key === dropNode.key);

    const filteredSiblings = currentSiblings.filter((s) => s.key !== dragNode.key);
    const dropNodeNewIdx = filteredSiblings.findIndex((s) => s.key === dropNode.key);

    let insertIdx = filteredSiblings.length;
    if (dropToGap && dropNodeOrigIdx !== -1 && dropNodeNewIdx !== -1) {
      const isAfter = info.dropPosition > dropNodeOrigIdx;
      insertIdx = isAfter ? dropNodeNewIdx + 1 : dropNodeNewIdx;
    }

    const newSiblings = [...filteredSiblings];
    newSiblings.splice(insertIdx, 0, {
      key: dragNode.key,
      nodeType: dragNode.nodeType,
      refId: dragNode.refId,
    });

    const folderSortOrders = new Map();
    newSiblings.forEach((node, idx) => {
      if (node.nodeType === 'folder') {
        folderSortOrders.set(node.refId, idx * 1000);
      }
    });

    // ── Optimistic local update via store ────────────────────────────────────
    if (dragNode.nodeType === 'doc') {
      applyDocMoved({ docId: dragNode.refId, folderId: targetFolderId });
    } else {
      // 更新拖拽文件夹的 parent_id + sort_order，以及所有受影响兄弟的 sort_order
      const updates = [...folderSortOrders.entries()].map(([fId, sortOrder]) => ({
        folder_id: fId,
        parent_id: fId === dragNode.refId ? targetFolderId : undefined,
        sort_order: sortOrder,
      }));
      updates.forEach((u) => applyFolderUpdated(u));
    }

    // ── Persist to server ────────────────────────────────────────────────────
    try {
      if (dragNode.nodeType === 'doc') {
        await moveDocToFolder(dragNode.refId, targetFolderId);
      } else {
        const dragSortOrder = folderSortOrders.get(dragNode.refId) ?? 0;
        await updateFolder(dragNode.refId, {
          parent_id: targetFolderId,
          sort_order: dragSortOrder,
        });
        await Promise.all(
          [...folderSortOrders.entries()]
            .filter(([fId]) => fId !== dragNode.refId)
            .map(([fId, sortOrder]) => updateFolder(fId, { sort_order: sortOrder })),
        );
      }
    } catch {
      // Rollback optimistic update
      rollback(prevSnapshot);
    }
  }

  // ── context menus ──────────────────────────────────────────────────────────

  function folderMenu(node) {
    const isReadonly = node.readonly;
    return {
      items: [
        // 只读外部文件夹：不允许在其中新建文档/子文件夹，不允许重命名/删除
        ...(!isReadonly
          ? [
              { key: 'new-doc', icon: <FileAddOutlined />, label: '在此新建文档' },
              { key: 'new', icon: <FolderAddOutlined />, label: '新建子文件夹' },
              { key: 'rename', icon: <EditOutlined />, label: '重命名' },
              { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
            ]
          : [
              {
                key: 'readonly-tip',
                label: '这是共享文件夹，无法编辑',
                disabled: true,
              },
            ]),
      ],
      onClick: ({ key, domEvent }) => {
        domEvent.stopPropagation();
        if (key === 'new-doc') handleCreateDocInFolder(node.refId);
        if (key === 'new') handleCreateFolder(node.refId);
        if (key === 'rename') openRename(node);
        if (key === 'delete') handleDeleteFolder(node);
      },
    };
  }

  function docMenu(node) {
    const movableFolders = folders.filter(
      (f) => f.parent_id === null && f.folder_id !== node.parentFolderId,
    );
    return {
      items: [
        {
          key: 'move-out',
          icon: <ExportOutlined />,
          label: '移出文件夹',
          disabled: node.parentFolderId === null,
        },
        ...(movableFolders.length > 0
          ? [
              {
                key: 'move-to',
                icon: <FolderAddOutlined />,
                label: '移至文件夹',
                children: movableFolders.map((f) => ({
                  key: `move:${f.folder_id}`,
                  label: f.name,
                })),
              },
            ]
          : []),
      ],
      onClick: ({ key, domEvent }) => {
        domEvent.stopPropagation();
        if (key === 'move-out') handleMoveDocOut(node);
        if (key.startsWith('move:')) handleMoveDocToFolder(node, key.slice('move:'.length));
      },
    };
  }

  // ── render helpers ─────────────────────────────────────────────────────────

  function renderTitle(node) {
    if (node.nodeType === 'placeholder') {
      return <span style={{ color: 'var(--doc-text-3)', fontSize: 12 }}>{node.title}</span>;
    }
    const isFolder = node.nodeType === 'folder';
    const menu = isFolder ? folderMenu(node) : docMenu(node);
    return (
      <Dropdown menu={menu} trigger={['contextMenu']}>
        <div className="doc-tree-node">
          <span className="doc-tree-node__label">{node.title}</span>
          <Dropdown menu={menu} trigger={['click']} placement="bottomRight">
            <MoreOutlined
              className="doc-tree-node__more"
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        </div>
      </Dropdown>
    );
  }

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="doc-tree">
      <div className="doc-left-sidebar__section-header" style={{ cursor: 'default' }}>
        <span>知识库</span>
        <Tooltip title="新建文件夹" placement="right">
          <FolderAddOutlined
            style={{ fontSize: 13, color: 'var(--doc-text-3)', cursor: 'pointer' }}
            onClick={() => handleCreateFolder(null)}
          />
        </Tooltip>
      </div>

      {loading ? (
        <div style={{ padding: '12px 16px', textAlign: 'center' }}>
          <Spin size="small" />
        </div>
      ) : treeData.length === 0 ? (
        <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--doc-text-3)' }}>
          还没有文件夹，点击右上角图标创建
        </div>
      ) : (
        <Tree
          blockNode
          draggable={{ icon: false }}
          allowDrop={({ dropNode }) =>
            dropNode.nodeType !== 'placeholder' && !dropNode.readonly
          }
          treeData={treeData}
          expandedKeys={expandedKeys}
          onExpand={handleExpand}
          selectedKeys={currentDocId ? [`doc:${currentDocId}`] : []}
          onDrop={handleDrop}
          onSelect={(_keys, { node }) => {
            if (node.nodeType === 'doc') onSelectDoc?.(node.refId);
          }}
          icon={({ data }) => {
            if (data?.nodeType === 'doc') return <FileTextOutlined />;
            if (data?.nodeType === 'placeholder') return null;
            return <FolderOutlined />;
          }}
          showIcon
          titleRender={renderTitle}
        />
      )}

      <Modal
        title="重命名文件夹"
        open={Boolean(renameTarget)}
        onOk={submitRename}
        onCancel={() => setRenameTarget(null)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Input
          ref={(el) => el && el.select()}
          value={renameValue}
          maxLength={128}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={submitRename}
          placeholder="请输入文件夹名称"
        />
      </Modal>
    </div>
  );
}
