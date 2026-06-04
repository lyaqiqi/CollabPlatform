import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal, Radio, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import DocEditor from '../components/DocEditor';
import DocShell from '../components/doc-layout/DocShell';
import DocImmersiveHeader from '../components/doc-layout/DocImmersiveHeader';
import DocLeftSidebar from '../components/doc-layout/DocLeftSidebar';
import DocRightPanel from '../components/doc-layout/DocRightPanel';
import DocTitleBlock from '../components/doc-layout/DocTitleBlock';
import Loading from '../components/Loading';
import {
  createDocComment,
  createCommentReply,
  createDocVersion,
  getDoc,
  getDocSidebar,
  inviteDocMember,
  removeDocMember,
  resolveDocComment,
  restoreDocVersion,
  updateDoc,
} from '../api/doc.api';
import { useDocCollaboration } from '../hooks/useDocCollaboration';
import { SOCKET_EVENTS } from '../utils/constants';
import useAuthStore from '../store/authStore';
import { applyPersistedYjsState, encodeYjsState } from '../collab/yjsUtils';
import Toast from '../components/Toast';
import '../styles/doc-tokens.css';
import '../styles/doc-layout.css';
import '../styles/doc-editor.css';
import '../styles/doc-overlays.css';

const SAVE_DEBOUNCE_MS = 2000;
const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',   // ``` 围栏风格代码块
  fence: '```',
});
turndown.use(gfm);  // 启用 GFM：表格、任务列表、删除线等

function DocPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    ydoc, provider, color, undoManager, connected, onlineUsers,
    socketEmit, socketOn, socketOff,
  } = useDocCollaboration(id, user);

  /* ── 文档元数据 ── */
  const [docMeta, setDocMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── 协作面板数据 ── */
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [checkpointSaving, setCheckpointSaving] = useState(false);
  const [sidebarData, setSidebarData] = useState({ comments: [], versions: [], members: [] });
  const [creatingComment, setCreatingComment] = useState(false);
  const [currentSelection, setCurrentSelection] = useState(null);
  const [activeCommentId, setActiveCommentId] = useState(null);

  /* ── 布局状态 ── */
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState('comments');
  const [outlineTree, setOutlineTree] = useState([]);

  const saveTimerRef = useRef(null);
  const ydocRef = useRef(null);
  const titleRef = useRef('');     // 始终保存最新 title，避免 closure 捕获旧值
  const hydratedRef = useRef(false); // 始终保存最新 hydrated，供 cleanup 判断
  const editorRef = useRef(null);

  useEffect(() => { ydocRef.current = ydoc; }, [ydoc]);
  useEffect(() => { hydratedRef.current = hydrated; }, [hydrated]);

  /* 加载文档元数据 */
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const doc = await getDoc(id);
        if (cancelled) return;
        setDocMeta(doc);
        setTitle(doc.title);
        titleRef.current = doc.title;
      } catch (err) {
        if (!cancelled) setError(err?.message || '加载文档失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  /* ── 实时同步：监听其他用户触发的文档级事件 ── */
  useEffect(() => {
    if (!id) return undefined;

    // 1. 其他用户恢复了版本快照 → 全员 reload
    const onVersionRestored = ({ itemId }) => {
      if (itemId !== id) return;
      Toast.info('协作者恢复了版本快照，文档即将刷新…');
      setTimeout(() => window.location.reload(), 1500);
    };

    // 2. 其他用户修改了标题 → 更新本地标题 state 和 ref
    const onTitleChanged = ({ itemId, title: remoteTitle }) => {
      if (itemId !== id) return;
      titleRef.current = remoteTitle;
      setTitle(remoteTitle);
    };

    // 3. 其他用户操作了评论/版本 → 静默刷新侧边栏
    const onSidebarChanged = ({ itemId }) => {
      if (itemId !== id) return;
      refreshSidebarQuiet();
    };

    socketOn(SOCKET_EVENTS.DOC_VERSION_RESTORED, onVersionRestored);
    socketOn(SOCKET_EVENTS.DOC_TITLE_CHANGED, onTitleChanged);
    socketOn(SOCKET_EVENTS.DOC_SIDEBAR_CHANGED, onSidebarChanged);

    return () => {
      socketOff(SOCKET_EVENTS.DOC_VERSION_RESTORED, onVersionRestored);
      socketOff(SOCKET_EVENTS.DOC_TITLE_CHANGED, onTitleChanged);
      socketOff(SOCKET_EVENTS.DOC_SIDEBAR_CHANGED, onSidebarChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, socketOn, socketOff]);

  /* 加载协作面板数据（内部实现，供带/不带 loading 的两个版本共用） */
  const fetchSidebar = useCallback(async () => {
    if (!id) return;
    const data = await getDocSidebar(id);
    setSidebarData({
      comments: data.comments || [],
      versions: data.versions || [],
      members: data.members || [],
    });
  }, [id]);

  const refreshSidebar = useCallback(async () => {
    setSidebarLoading(true);
    try {
      await fetchSidebar();
    } catch (err) {
      Toast.error(err?.message || '加载协作信息失败');
    } finally {
      setSidebarLoading(false);
    }
  }, [fetchSidebar]);

  /* 静默刷新侧边栏（由远端事件触发，不显示 loading） */
  const refreshSidebarQuiet = useCallback(async () => {
    try { await fetchSidebar(); } catch { /* 静默忽略 */ }
  }, [fetchSidebar]);

  useEffect(() => { refreshSidebar(); }, [refreshSidebar]);

  /* Yjs 快照还原（仅一次） */
  useEffect(() => {
    if (!ydoc || !docMeta || hydrated) return;
    applyPersistedYjsState(ydoc, docMeta.content_data?.yjs_state);
    setHydrated(true);
  }, [ydoc, docMeta, hydrated]);

  /* 防抖保存 — persistDoc 读 ref 而非 closure，避免快速输入时保存旧值 */
  const persistDoc = useCallback(async () => {
    const currentYdoc = ydocRef.current;
    if (!id || !currentYdoc) return;
    setSaving(true);
    try {
      await updateDoc(id, {
        title: titleRef.current,
        content_data: { yjs_state: encodeYjsState(currentYdoc) },
      });
    } catch (err) {
      Toast.error(err?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [id]);   // 不依赖 title，读 ref 即可

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await persistDoc();
      // 通知同房间其他用户标题已更新（读 ref 拿最新值）
      if (id && socketEmit) {
        socketEmit(SOCKET_EVENTS.DOC_TITLE_CHANGED, {
          itemId: id,
          title: titleRef.current,
        });
      }
    }, SAVE_DEBOUNCE_MS);
  }, [persistDoc, id, socketEmit]);

  useEffect(() => {
    if (!ydoc || !hydrated) return undefined;
    const onUpdate = (_update, origin) => { if (origin !== 'persisted') scheduleSave(); };
    ydoc.on('update', onUpdate);
    return () => ydoc.off('update', onUpdate);
  }, [ydoc, hydrated, scheduleSave]);

  /* 离开时同步保存 —— 仅依赖 id，避免 title 变化触发 cleanup；
     且必须已 hydrated，否则会把尚未注水的空 Y.Doc 覆盖到服务器，清空文档 */
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const cur = ydocRef.current;
      if (cur && id && hydratedRef.current) {
        updateDoc(id, {
          title: titleRef.current,
          content_data: { yjs_state: encodeYjsState(cur) },
        }).catch(() => {});
      }
    };
  }, [id]);

  const editorReady = ydoc && provider && user && hydrated;

  /* 版本快照 */
  const handleCreateCheckpoint = useCallback(async (label) => {
    if (!id || !ydocRef.current) return;
    setCheckpointSaving(true);
    try {
      await persistDoc();
      await createDocVersion(id, {
        content_snapshot: {
          yjs_state: encodeYjsState(ydocRef.current),
          title: titleRef.current,
          label: label || undefined,
          created_by: user?.user_id,
        },
      });
      Toast.success('已创建版本快照');
      await refreshSidebar();
      socketEmit(SOCKET_EVENTS.DOC_SIDEBAR_CHANGED, { itemId: id });
      setRightPanelTab('versions');
    } catch (err) {
      Toast.error(err?.message || '创建版本快照失败');
    } finally {
      setCheckpointSaving(false);
    }
  }, [id, persistDoc, refreshSidebar, title, user?.user_id]);

  /* 版本恢复 */
  const handleRestoreVersion = useCallback(async (versionId) => {
    if (!id || !versionId) return;
    try {
      await restoreDocVersion(id, versionId);
      Toast.success('版本已恢复，即将刷新页面…');
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      Toast.error(err?.message || '版本恢复失败');
    }
  }, [id]);

  /* 解决评论 */
  const handleResolveComment = useCallback(async (commentId) => {
    if (!id || !commentId) return;
    try {
      await resolveDocComment(id, commentId, { is_resolved: true });
      Toast.success('评论已标记为解决');
      if (activeCommentId === commentId) setActiveCommentId(null);
      await refreshSidebar();
      socketEmit(SOCKET_EVENTS.DOC_SIDEBAR_CHANGED, { itemId: id });
    } catch (err) {
      Toast.error(err?.message || '更新评论状态失败');
    }
  }, [activeCommentId, id, refreshSidebar]);

  /* 创建评论 */
  const handleCreateComment = useCallback(async (content) => {
    if (!id) return false;
    const selected = editorRef.current?.getCurrentSelection?.() || currentSelection;
    if (!selected?.from || !selected?.to || selected.to <= selected.from) {
      Toast.warning('请先在正文中选择一段文本');
      return false;
    }
    setCreatingComment(true);
    try {
      await createDocComment(id, {
        content,
        position: { from: selected.from, to: selected.to, selected_text: selected.text || '' },
      });
      Toast.success('评论已添加');
      await refreshSidebar();
      socketEmit(SOCKET_EVENTS.DOC_SIDEBAR_CHANGED, { itemId: id });
      setActiveCommentId(null);
      return true;
    } catch (err) {
      Toast.error(err?.message || '创建评论失败');
      return false;
    } finally {
      setCreatingComment(false);
    }
  }, [currentSelection, id, refreshSidebar]);

  /* 评论回复 */
  const handleCreateReply = useCallback(async (commentId, content) => {
    if (!id || !commentId) return false;
    try {
      await createCommentReply(id, commentId, { content });
      Toast.success('回复已发送');
      await refreshSidebar();
      socketEmit(SOCKET_EVENTS.DOC_SIDEBAR_CHANGED, { itemId: id });
      return true;
    } catch (err) {
      Toast.error(err?.message || '回复失败');
      return false;
    }
  }, [id, refreshSidebar]);

  /* 跳转到评论锚点 */
  const handleJumpToComment = useCallback((comment) => {
    const position = comment?.position;
    if (!position?.from || !position?.to) { Toast.warning('该评论缺少锚点信息'); return; }
    editorRef.current?.jumpToPosition?.({ from: position.from, to: position.to });
    setActiveCommentId(comment.comment_id);
  }, []);

  /* 全文搜索 — 返回结果数组，同时跳转到第一条 */
  const handleSearchInDoc = useCallback((keyword) => {
    const results = editorRef.current?.findInDocument?.(keyword) ?? [];
    if (results.length > 0) {
      editorRef.current?.highlightAndJump?.(results[0].from, results[0].to);
    }
    return results;
  }, []);

  /* 搜索结果条目点击跳转 */
  const handleJumpToDocResult = useCallback((from, to) => {
    editorRef.current?.highlightAndJump?.(from, to);
  }, []);

  /* 搜索面板目录跳转 */
  const handleJumpToOutlineFromSearch = useCallback((pos) => {
    editorRef.current?.jumpToPosition?.({ from: pos, to: pos + 1 });
  }, []);

  /* 分享链接 */
  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      Toast.success('链接已复制到剪贴板');
    } catch {
      Toast.error('复制失败，请手动复制地址栏链接');
    }
  }, []);

  /* 导出文档 */
  const handleExport = useCallback(() => {
    let exportFormat = 'markdown';
    Modal.confirm({
      title: '导出文档',
      content: (
        <Radio.Group
          defaultValue="markdown"
          onChange={(e) => { exportFormat = e.target.value; }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}
        >
          <Radio value="markdown">Markdown (.md)</Radio>
          <Radio value="html">HTML (.html)</Radio>
        </Radio.Group>
      ),
      okText: '导出',
      cancelText: '取消',
      onOk: () => {
        const html = editorRef.current?.getHTML?.() ?? '';
        let content, filename, mime;
        if (exportFormat === 'markdown') {
          content = turndown.turndown(html);
          filename = `${titleRef.current || '文档'}.md`;
          mime = 'text/markdown;charset=utf-8';
        } else {
          content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titleRef.current}</title></head><body>${html}</body></html>`;
          filename = `${titleRef.current || '文档'}.html`;
          mime = 'text/html;charset=utf-8';
        }
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        Toast.success(`已导出为 ${filename}`);
      },
    });
  }, [title]);

  /* 邀请成员 */
  const handleInviteMember = useCallback(async (emailOrUsername, role) => {
    if (!id) return false;
    try {
      await inviteDocMember(id, { email_or_username: emailOrUsername, role });
      Toast.success('成员已邀请');
      await refreshSidebar();
      return true;
    } catch (err) {
      Toast.error(err?.message || '邀请失败');
      return false;
    }
  }, [id, refreshSidebar]);

  /* 移除成员 */
  const handleRemoveMember = useCallback(async (targetUserId) => {
    if (!id) return;
    try {
      await removeDocMember(id, targetUserId);
      Toast.success('成员已移除');
      await refreshSidebar();
    } catch (err) {
      Toast.error(err?.message || '移除失败');
    }
  }, [id, refreshSidebar]);

  /* 打开右侧面板 */
  const openRightPanel = useCallback((tabKey) => {
    if (tabKey) setRightPanelTab(tabKey);
    setRightPanelOpen(true);
  }, []);

  /* ── 加载中 ── */
  if (loading) return <Loading />;

  /* ── 错误态 ── */
  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <Alert type="error" message={error} showIcon />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/')}>返回首页</Button>
      </div>
    );
  }

  /* ── 主布局 ── */
  return (
    <DocShell
      leftCollapsed={leftCollapsed}
      rightOpen={rightPanelOpen}
      header={
        <DocImmersiveHeader
          title={title}
          onlineUsers={onlineUsers}
          onToggleLeft={() => setLeftCollapsed((p) => !p)}
          leftCollapsed={leftCollapsed}
          onOpenComments={() => openRightPanel('comments')}
          onOpenVersions={() => openRightPanel('versions')}
          onOpenSearch={() => openRightPanel('search')}
          onShare={handleShare}
          onExport={handleExport}
        />
      }
      left={
        <DocLeftSidebar
          outlineTree={outlineTree}
          onJumpToOutline={(pos) => editorRef.current?.jumpToPosition?.({ from: pos, to: pos + 1 })}
          onOpenVersions={() => openRightPanel('versions')}
        />
      }
      center={
        <div className="doc-center-canvas">
          {!connected && (
            <div className="doc-offline-banner">
              协作通道已断开，本地编辑将在重新连接后自动同步…
            </div>
          )}

          <DocTitleBlock
            title={title}
            onTitleChange={(v) => { setTitle(v); titleRef.current = v; scheduleSave(); }}
            onTitleBlur={persistDoc}
            saving={saving}
            connected={connected}
            undoManager={undoManager}
          />

          <div className="doc-content-divider" />

          {!editorReady ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
              <Spin tip="正在初始化编辑器…" />
            </div>
          ) : (
            <DocEditor
              ref={editorRef}
              ydoc={ydoc}
              provider={provider}
              user={user}
              color={color}
              undoManager={undoManager}
              onSelectionChange={setCurrentSelection}
              onCreateCommentFromSelection={() => openRightPanel('comments')}
              onDocumentOutlineChange={setOutlineTree}
              commentAnchors={sidebarData.comments}
              activeCommentId={activeCommentId}
            />
          )}
        </div>
      }
      right={
        <DocRightPanel
          open={rightPanelOpen}
          activeTab={rightPanelTab}
          onTabChange={setRightPanelTab}
          onClose={() => setRightPanelOpen(false)}
          loading={sidebarLoading}
          comments={sidebarData.comments}
          versions={sidebarData.versions}
          members={sidebarData.members}
          outline={outlineTree}
          checkpointSaving={checkpointSaving}
          onCreateCheckpoint={handleCreateCheckpoint}
          onResolveComment={handleResolveComment}
          onCreateComment={handleCreateComment}
          onJumpToComment={handleJumpToComment}
          onCreateReply={handleCreateReply}
          onRestoreVersion={handleRestoreVersion}
          onSearchInDoc={handleSearchInDoc}
          onJumpToDocResult={handleJumpToDocResult}
          onJumpToOutline={handleJumpToOutlineFromSearch}
          onInviteMember={handleInviteMember}
          onRemoveMember={handleRemoveMember}
          currentSelection={currentSelection}
          creatingComment={creatingComment}
          activeCommentId={activeCommentId}
        />
      }
    />
  );
}

export default DocPage;
