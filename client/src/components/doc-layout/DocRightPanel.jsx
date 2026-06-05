import { useMemo, useState } from 'react';
import { Button, Empty, Input, Modal, Select, Spin, Switch, Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  HistoryOutlined,
  MessageOutlined,
  SearchOutlined,
  SendOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';

function formatTime(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return String(value);
  }
}

/* ─────────────── 评论卡片（支持回复线程） ─────────────── */
function CommentCard({ item, activeCommentId, onResolveComment, onJumpToComment, onCreateReply }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const handleReply = async () => {
    const content = replyText.trim();
    if (!content) return;
    setReplying(true);
    const ok = await onCreateReply(item.comment_id, content);
    setReplying(false);
    if (ok) { setReplyText(''); setReplyOpen(false); }
  };

  return (
    <div className={`comment-card${activeCommentId === item.comment_id ? ' comment-card--active' : ''}`}>
      {item.position?.selected_text && (
        <div className="comment-card__quote">{item.position.selected_text}</div>
      )}
      <div className="comment-card__meta">
        <span className="comment-card__author">{item.author?.username || '未知用户'}</span>
        <span className="comment-card__time">{formatTime(item.created_at)}</span>
      </div>
      <div className="comment-card__content">{item.content}</div>
      <div className="comment-card__actions">
        {item.is_resolved ? (
          <Tag color="success" style={{ fontSize: 11, borderRadius: 'var(--doc-radius-xs)', margin: 0 }}>已解决</Tag>
        ) : (
          <>
            <Tooltip title="标记为已解决">
              <Button type="text" size="small" icon={<CheckCircleOutlined />}
                style={{ fontSize: 12, color: 'var(--doc-text-3)', padding: '0 4px' }}
                onClick={() => onResolveComment(item.comment_id)}>解决</Button>
            </Tooltip>
            <Tooltip title="回复">
              <Button type="text" size="small" icon={<SendOutlined />}
                style={{ fontSize: 12, color: 'var(--doc-text-3)', padding: '0 4px' }}
                onClick={() => setReplyOpen((v) => !v)}>回复</Button>
            </Tooltip>
          </>
        )}
        {item.position?.from && item.position?.to && (
          <Tooltip title="跳转到正文锚点">
            <Button type="text" size="small" icon={<EnvironmentOutlined />}
              style={{ fontSize: 12, color: 'var(--doc-text-3)', padding: '0 4px' }}
              onClick={() => onJumpToComment(item)}>定位</Button>
          </Tooltip>
        )}
      </div>

      {item.replies?.length > 0 && (
        <div className="comment-replies">
          {item.replies.map((reply) => (
            <div key={reply.comment_id} className="comment-reply">
              <span className="comment-reply__author">{reply.author?.username || '未知用户'}</span>
              <span className="comment-reply__time">{formatTime(reply.created_at)}</span>
              <div className="comment-reply__content">{reply.content}</div>
            </div>
          ))}
        </div>
      )}

      {replyOpen && !item.is_resolved && (
        <div className="comment-reply-compose">
          <Input.TextArea value={replyText} onChange={(e) => setReplyText(e.target.value)}
            placeholder="写下回复…" autoSize={{ minRows: 1, maxRows: 3 }}
            style={{ fontSize: 13, borderRadius: 'var(--doc-radius-sm)' }}
            onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleReply(); } }} />
          <Button type="primary" size="small" block disabled={!replyText.trim()} loading={replying}
            onClick={handleReply} style={{ marginTop: 6, borderRadius: 'var(--doc-radius-sm)' }}>发送</Button>
        </div>
      )}
    </div>
  );
}

/* ─────────────── 评论面板 ─────────────── */
function CommentsPanel({
  comments, currentSelection, creatingComment,
  onCreateComment, onResolveComment, onJumpToComment,
  activeCommentId, onCreateReply,
}) {
  const [commentInput, setCommentInput] = useState('');
  const [onlyUnresolved, setOnlyUnresolved] = useState(false);

  const hasSelection = Boolean(
    currentSelection &&
    Number.isFinite(currentSelection.from) &&
    Number.isFinite(currentSelection.to) &&
    currentSelection.to > currentSelection.from
  );

  const displayed = useMemo(
    () => (onlyUnresolved ? comments.filter((c) => !c.is_resolved) : comments),
    [comments, onlyUnresolved]
  );

  const handleCreate = async () => {
    const content = commentInput.trim();
    if (!content || !hasSelection) return;
    const ok = await onCreateComment(content);
    if (ok) setCommentInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="comment-compose">
        {hasSelection ? (
          <div className="comment-compose__quote">"{currentSelection.text?.slice(0, 60) || '已选中文本'}"</div>
        ) : (
          <div className="comment-compose__placeholder">在正文选中文字后可添加评论</div>
        )}
        {hasSelection && (
          <>
            <Input.TextArea value={commentInput} onChange={(e) => setCommentInput(e.target.value)}
              placeholder="写下你的评论…" autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ fontSize: 13, borderColor: 'var(--doc-border)', borderRadius: 'var(--doc-radius-sm)' }}
              onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleCreate(); } }} />
            <Button type="primary" size="small" block disabled={!commentInput.trim()} loading={creatingComment}
              onClick={handleCreate} style={{ marginTop: 8, borderRadius: 'var(--doc-radius-sm)' }}>发送评论</Button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--doc-border-light)' }}>
        <span style={{ fontSize: 12, color: 'var(--doc-text-3)' }}>
          共 {comments.length} 条 · {comments.filter((c) => !c.is_resolved).length} 未解决
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--doc-text-3)' }}>只看未解决</span>
          <Switch size="small" checked={onlyUnresolved} onChange={setOnlyUnresolved} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {displayed.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<span style={{ fontSize: 12, color: 'var(--doc-text-3)' }}>暂无评论</span>}
            style={{ padding: '32px 0' }} />
        ) : (
          displayed.map((item) => (
            <CommentCard key={item.comment_id} item={item} activeCommentId={activeCommentId}
              onResolveComment={onResolveComment} onJumpToComment={onJumpToComment}
              onCreateReply={onCreateReply} />
          ))
        )}
      </div>
    </div>
  );
}

/* ─────────────── 版本历史面板 ─────────────── */
/* ─────────────── 版本历史面板 ─────────────── */
function VersionsPanel({ 
  versions, 
  onCreateCheckpoint, 
  checkpointSaving, 
  onRestoreVersion,
  onPreviewVersion,
  currentUserRole,
}) {
  const [label, setLabel] = useState('');

  const handleCreate = () => {
    onCreateCheckpoint(label.trim() || undefined);
    setLabel('');
  };

  const handleRestore = (version, num) => {
    if (currentUserRole !== 'owner') {
      Modal.warning({ title: '权限不足', content: '只有文档所有者可以恢复版本' });
      return;
    }
    const vLabel = version.content_snapshot?.label ? `"${version.content_snapshot.label}"` : `#${num}`;
    Modal.confirm({
      title: '确认恢复版本',
      content: `恢复后文档内容将回滚到版本 ${vLabel}，当前内容将被覆盖。确定继续？`,
      okText: '恢复',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => onRestoreVersion(version.version_id),
    });
  };

  return (
    <div>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--doc-border-light)' }}>
        <Input value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="版本备注（可选）"
          style={{ marginBottom: 8, borderRadius: 'var(--doc-radius-sm)', fontSize: 13 }}
          maxLength={50} />
        <Button onClick={handleCreate} loading={checkpointSaving} icon={<HistoryOutlined />}
          style={{ borderRadius: 'var(--doc-radius-sm)', width: '100%' }}>
          创建版本快照
        </Button>
      </div>

      {versions.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<span style={{ fontSize: 12, color: 'var(--doc-text-3)' }}>暂无版本快照</span>}
          style={{ padding: '32px 0' }} />
      ) : (
        versions.map((item, index) => {
          const vLabel = item.content_snapshot?.label;
          const num = versions.length - index;
          return (
            <div key={item.version_id || index} className="version-item">
              <div className="version-item__badge">{num}</div>
              <div className="version-item__info" style={{ flex: 1 }}>
                <div className="version-item__label">{vLabel || `版本快照 #${num}`}</div>
                <div className="version-item__time">{formatTime(item.created_at)}</div>
              </div>
              <Tooltip title="预览版本内容">
                <Button type="text" size="small"
                  style={{ fontSize: 12, color: 'var(--doc-brand)', flexShrink: 0 }}
                  onClick={() => onPreviewVersion?.(item)}>预览</Button>
              </Tooltip>
              <Tooltip title="恢复到此版本">
                <Button type="text" size="small"
                  style={{ fontSize: 12, color: 'var(--doc-brand)', flexShrink: 0 }}
                  onClick={() => handleRestore(item, num)}>恢复</Button>
              </Tooltip>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ─────────────── 搜索面板（全文搜索 + 目录跳转 + 成员管理） ─────────────── */
function SearchPanel({
  comments, members, outline,
  onJumpToComment, onSearchInDoc, onJumpToDocResult, onJumpToOutline,
  onInviteMember, onRemoveMember,
}) {
  const [keyword, setKeyword] = useState('');
  const [docResults, setDocResults] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);

  const matchedComments = useMemo(() => {
    if (!keyword.trim()) return [];
    return comments.filter((c) => c.content?.includes(keyword));
  }, [comments, keyword]);

  const matchedOutline = useMemo(() => {
    if (!keyword.trim()) return outline;
    return outline.filter((o) => o.text?.toLowerCase().includes(keyword.toLowerCase()));
  }, [outline, keyword]);

  const handleSearch = (val) => {
    setKeyword(val);
    if (val.trim() && typeof onSearchInDoc === 'function') {
      setDocResults(onSearchInDoc(val) || []);
    } else {
      setDocResults([]);
    }
  };

  const handleInvite = async () => {
    if (!inviteQuery.trim()) return;
    setInviting(true);
    const ok = await onInviteMember?.(inviteQuery.trim(), inviteRole);
    setInviting(false);
    if (ok) { setInviteQuery(''); setInviteOpen(false); }
  };

  return (
    <div style={{ padding: '12px 16px' }}>
      <Input
        prefix={<SearchOutlined style={{ color: 'var(--doc-text-3)' }} />}
        allowClear
        placeholder="搜索正文、标题、评论…"
        value={keyword}
        onChange={(e) => handleSearch(e.target.value)}
        style={{ borderRadius: 'var(--doc-radius-sm)', marginBottom: 12 }}
      />

      {keyword.trim() && (
        <>
          {/* ── 正文命中 ── */}
          <div className="search-section-title">正文命中（{docResults.length}）</div>
          {docResults.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--doc-text-3)', marginBottom: 12 }}>无</div>
          ) : (
            docResults.slice(0, 20).map((r, i) => (
              <div
                key={i}
                className="search-result-item"
                onClick={() => onJumpToDocResult?.(r.from, r.to)}
              >
                <span style={{ fontWeight: 500, color: 'var(--doc-brand)' }}>…{r.text}…</span>
              </div>
            ))
          )}

          {/* ── 目录命中 ── */}
          <div className="search-section-title" style={{ marginTop: 12 }}>目录命中</div>
          {matchedOutline.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--doc-text-3)', marginBottom: 12 }}>无</div>
          ) : (
            matchedOutline.map((item) => (
              <div
                key={item.id}
                className="search-result-item"
                onClick={() => onJumpToOutline?.(item.pos)}
              >
                H{item.level} · {item.text}
              </div>
            ))
          )}

          {/* ── 评论命中 ── */}
          <div className="search-section-title" style={{ marginTop: 12 }}>评论命中</div>
          {matchedComments.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--doc-text-3)' }}>无</div>
          ) : (
            matchedComments.map((item) => (
              <div key={item.comment_id} className="comment-card" onClick={() => onJumpToComment(item)}>
                <div className="comment-card__content">{item.content}</div>
              </div>
            ))
          )}
        </>
      )}

      {!keyword.trim() && (
        <div>
          {/* ── 协作成员列表 ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="search-section-title" style={{ margin: 0 }}>
              <TeamOutlined style={{ marginRight: 4 }} />协作成员
            </div>
            <Tooltip title="邀请成员">
              <Button
                type="text" size="small" icon={<UserAddOutlined />}
                style={{ fontSize: 12, color: 'var(--doc-brand)' }}
                onClick={() => setInviteOpen((v) => !v)}
              >邀请</Button>
            </Tooltip>
          </div>

          {/* 邀请表单 */}
          {inviteOpen && (
            <div style={{ background: 'var(--doc-hover)', borderRadius: 'var(--doc-radius-sm)', padding: '10px 12px', marginBottom: 12 }}>
              <Input
                value={inviteQuery}
                onChange={(e) => setInviteQuery(e.target.value)}
                placeholder="邮箱或用户名"
                size="small"
                style={{ marginBottom: 6, borderRadius: 'var(--doc-radius-sm)', fontSize: 13 }}
                onPressEnter={handleInvite}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <Select
                  value={inviteRole}
                  onChange={setInviteRole}
                  size="small"
                  style={{ flex: 1, fontSize: 13 }}
                  options={[
                    { value: 'editor', label: '可编辑' },
                    { value: 'viewer', label: '仅查看' },
                  ]}
                />
                <Button type="primary" size="small" loading={inviting}
                  disabled={!inviteQuery.trim()} onClick={handleInvite}
                  style={{ borderRadius: 'var(--doc-radius-sm)' }}>
                  邀请
                </Button>
              </div>
            </div>
          )}

          {/* 成员列表 */}
          {members.map((item) => (
            <div key={item.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--doc-border-light)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--doc-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {(item.username || 'U').slice(0, 1).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: 'var(--doc-text)', flex: 1 }}>{item.username}</span>
              <Tag style={{ fontSize: 11, margin: 0 }} color={item.role === 'owner' ? 'gold' : item.role === 'editor' ? 'blue' : 'default'}>
                {item.role === 'owner' ? '所有者' : item.role === 'editor' ? '编辑者' : '查看者'}
              </Tag>
              {item.role !== 'owner' && onRemoveMember && (
                <Tooltip title="移除成员">
                  <Button
                    type="text" size="small" icon={<DeleteOutlined />}
                    style={{ fontSize: 12, color: 'var(--doc-text-3)', padding: '0 2px' }}
                    onClick={() => {
                      Modal.confirm({
                        title: '移除成员',
                        content: `确认将 ${item.username} 从文档移除？`,
                        okText: '移除', okButtonProps: { danger: true },
                        cancelText: '取消',
                        onOk: () => onRemoveMember(item.user_id),
                      });
                    }}
                  />
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── 右侧面板主组件 ─────────────── */
const TABS = [
  { key: 'comments', icon: <MessageOutlined />, title: '评论' },
  { key: 'versions', icon: <HistoryOutlined />, title: '版本历史' },
  { key: 'search', icon: <SearchOutlined />, title: '搜索 & 成员' },
];

export default function DocRightPanel({
  open, activeTab, onTabChange, onClose,
  loading,
  comments = [], versions = [], members = [], outline = [],
  checkpointSaving, onCreateCheckpoint,
  onResolveComment, onCreateComment, onJumpToComment,
  onCreateReply, onRestoreVersion,
  onSearchInDoc, onJumpToDocResult, onJumpToOutline,
  onInviteMember, onRemoveMember,
  currentSelection, creatingComment, activeCommentId,
  onPreviewVersion,
  currentUserRole,
}) {
  if (!open) return null;

  return (
    <div className="doc-right-panel">
      <div className="doc-right-panel__header">
        <div className="doc-right-panel__tabs">
          {TABS.map((tab) => (
            <Tooltip key={tab.key} title={tab.title} placement="bottom">
              <div
                className={`doc-right-panel__tab${activeTab === tab.key ? ' doc-right-panel__tab--active' : ''}`}
                onClick={() => onTabChange(tab.key)}
                role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onTabChange(tab.key)}
              >
                {tab.icon}
              </div>
            </Tooltip>
          ))}
        </div>
        <Tooltip title="关闭" placement="left">
          <button className="doc-icon-btn" onClick={onClose} type="button">
            <CloseOutlined style={{ fontSize: 14 }} />
          </button>
        </Tooltip>
      </div>

      <div className="doc-right-panel__body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}><Spin /></div>
        ) : (
          <>
            {activeTab === 'comments' && (
              <CommentsPanel
                comments={comments} currentSelection={currentSelection}
                creatingComment={creatingComment} onCreateComment={onCreateComment}
                onResolveComment={onResolveComment} onJumpToComment={onJumpToComment}
                activeCommentId={activeCommentId} onCreateReply={onCreateReply}
              />
            )}
            {activeTab === 'versions' && (
              <VersionsPanel 
                versions={versions} 
                onCreateCheckpoint={onCreateCheckpoint}
                checkpointSaving={checkpointSaving} 
                onRestoreVersion={onRestoreVersion}
                onPreviewVersion={onPreviewVersion}
                currentUserRole={currentUserRole}
              />
            )}
            {activeTab === 'search' && (
              <SearchPanel
                comments={comments} members={members} outline={outline}
                onJumpToComment={onJumpToComment}
                onSearchInDoc={onSearchInDoc}
                onJumpToDocResult={onJumpToDocResult}
                onJumpToOutline={onJumpToOutline}
                onInviteMember={onInviteMember}
                onRemoveMember={onRemoveMember}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
