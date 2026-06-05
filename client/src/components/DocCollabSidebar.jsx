import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Input, List, Segmented, Space, Switch, Tag, Typography } from 'antd';

const VIEW_KEYS = ['comments', 'highlights', 'search', 'versions'];

function formatTime(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch (_err) {
    return String(value);
  }
}

function roleTag(role) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'owner') return <Tag color="gold">Owner</Tag>;
  if (normalized === 'editor') return <Tag color="blue">Editor</Tag>;
  return <Tag>Viewer</Tag>;
}

export default function DocCollabSidebar({
  activeKey,
  onActiveChange,
  comments,
  versions,
  members,
  outline = [],
  onCreateCheckpoint,
  checkpointSaving,
  onResolveComment,
  onCreateComment,
  onCreateReply,
  onJumpToComment,
  currentSelection,
  creatingComment,
  activeCommentId,
  onPreviewVersion,
  embedded = false,
}) {
  const [commentInput, setCommentInput] = useState('');
  const [onlyUnresolved, setOnlyUnresolved] = useState(false);
  const [unresolvedCursor, setUnresolvedCursor] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyInput, setReplyInput] = useState('');

  const options = useMemo(
    () => [
      { label: `评论 ${comments.length}`, value: 'comments' },
      { label: `高亮 ${comments.length}`, value: 'highlights' },
      { label: '搜索', value: 'search' },
      { label: `版本 ${versions.length}`, value: 'versions' },
    ],
    [comments.length, versions.length]
  );

  const hasSelection = Boolean(
    currentSelection &&
      Number.isFinite(currentSelection.from) &&
      Number.isFinite(currentSelection.to) &&
      currentSelection.to > currentSelection.from
  );

  const displayedComments = useMemo(() => {
    if (!onlyUnresolved) return comments;
    return comments.filter((item) => !item.is_resolved);
  }, [comments, onlyUnresolved]);

  const unresolvedComments = useMemo(
    () => comments.filter((item) => !item.is_resolved && item.position?.from && item.position?.to),
    [comments]
  );

  useEffect(() => {
    setUnresolvedCursor(0);
  }, [comments.length, onlyUnresolved]);

  const handleCreateComment = async () => {
    const content = commentInput.trim();
    if (!content || !hasSelection) return;
    const ok = await onCreateComment(content);
    if (ok) setCommentInput('');
  };

  const handleJumpNextUnresolved = () => {
    if (!unresolvedComments.length) return;
    const idx = unresolvedCursor % unresolvedComments.length;
    onJumpToComment(unresolvedComments[idx]);
    setUnresolvedCursor((prev) => prev + 1);
  };

  const handleReply = async (commentId) => {
    const content = replyInput.trim();
    if (!content || !commentId) return;
    const ok = await onCreateReply(commentId, content);
    if (ok) {
      setReplyingTo(null);
      setReplyInput('');
    }
  };

  return (
    <div
      style={{
        width: embedded ? '100%' : 320,
        borderLeft: embedded ? 'none' : '1px solid #f0f0f0',
        paddingLeft: embedded ? 0 : 16,
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            协作面板
          </Typography.Title>
          <Button size="small" onClick={onCreateCheckpoint} loading={checkpointSaving}>
            创建快照
          </Button>
        </Space>

        <Segmented
          block
          options={options}
          value={VIEW_KEYS.includes(activeKey) ? activeKey : 'comments'}
          onChange={onActiveChange}
        />

        {activeKey === 'comments' && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  仅看未解决
                </Typography.Text>
                <Switch
                  size="small"
                  checked={onlyUnresolved}
                  onChange={(checked) => setOnlyUnresolved(checked)}
                />
              </Space>
              <Button
                size="small"
                disabled={!unresolvedComments.length}
                onClick={handleJumpNextUnresolved}
              >
                跳转下一个未解决评论
              </Button>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {hasSelection
                  ? `当前选区: ${currentSelection.text || '(无文本内容)'}`.slice(0, 120)
                  : '先在正文中选择一段文本，再创建评论'}
              </Typography.Text>
              <Input.TextArea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder={hasSelection ? '输入评论内容...' : '请先选择正文文本'}
                autoSize={{ minRows: 2, maxRows: 4 }}
                disabled={!hasSelection}
              />
              <Button
                type="primary"
                block
                disabled={!hasSelection || !commentInput.trim()}
                loading={creatingComment}
                onClick={handleCreateComment}
              >
                添加评论到选区
              </Button>
            </Space>

            <List
              size="small"
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无评论" /> }}
              dataSource={displayedComments}
              renderItem={(item) => (
                <List.Item
                  className={item.comment_id === activeCommentId ? 'doc-comment-card--active' : ''}
                  actions={[
                    <Button
                      key="locate"
                      type="link"
                      size="small"
                      disabled={!item.position?.from || !item.position?.to}
                      onClick={() => onJumpToComment(item)}
                    >
                      定位
                    </Button>,
                    <Button
                      key="resolve"
                      type="link"
                      size="small"
                      disabled={item.is_resolved}
                      onClick={() => onResolveComment(item.comment_id)}
                    >
                      {item.is_resolved ? '已解决' : '标记已解决'}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Typography.Text>{item.author?.username || '未知用户'}</Typography.Text>
                        {item.is_resolved ? <Tag color="green">已解决</Tag> : <Tag color="orange">待处理</Tag>}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        <Typography.Text>{item.content}</Typography.Text>

                        {item.replies?.length > 0 && (
                          <div style={{ marginLeft: 8, paddingLeft: 10, borderLeft: '2px solid #e8e8e8' }}>
                            {item.replies.map((reply) => (
                              <div key={reply.comment_id} style={{ padding: '6px 0' }}>
                                <Space size={4}>
                                  <Typography.Text strong style={{ fontSize: 12 }}>
                                    {reply.author?.username || '未知用户'}
                                  </Typography.Text>
                                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                    {formatTime(reply.created_at)}
                                  </Typography.Text>
                                </Space>
                                <Typography.Text style={{ fontSize: 13, display: 'block' }}>
                                  {reply.content}
                                </Typography.Text>
                              </div>
                            ))}
                          </div>
                        )}

                        {replyingTo === item.comment_id ? (
                          <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            <Input.TextArea
                              value={replyInput}
                              onChange={(e) => setReplyInput(e.target.value)}
                              placeholder="输入回复内容..."
                              autoSize={{ minRows: 2, maxRows: 4 }}
                            />
                            <Space>
                              <Button
                                type="primary"
                                size="small"
                                disabled={!replyInput.trim()}
                                onClick={() => handleReply(item.comment_id)}
                              >
                                发送回复
                              </Button>
                              <Button
                                size="small"
                                onClick={() => { setReplyingTo(null); setReplyInput(''); }}
                              >
                                取消
                              </Button>
                            </Space>
                          </Space>
                        ) : (
                          <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, height: 'auto' }}
                            onClick={() => setReplyingTo(item.comment_id)}
                          >
                            回复
                          </Button>
                        )}

                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {formatTime(item.created_at)}
                        </Typography.Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Space>
        )}

        {activeKey === 'versions' && (
          <List
            size="small"
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无版本快照" /> }}
            dataSource={versions}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  <Button
                    key="preview"
                    type="link"
                    size="small"
                    onClick={() => onPreviewVersion?.(item)}
                  >
                    预览
                  </Button>,
                  <Button
                    key="restore"
                    type="link"
                    size="small"
                    onClick={() => onRestoreVersion(item.version_id)}
                  >
                    恢复
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={`版本 #${versions.length - index}`}
                  description={
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {formatTime(item.created_at)}
                      {item.content_snapshot?.label && ` · ${item.content_snapshot.label}`}
                    </Typography.Text>
                  }
                />
              </List.Item>
            )}
          />
        )}

        {activeKey === 'highlights' && (
          <List
            size="small"
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无高亮批注" /> }}
            dataSource={comments.filter((item) => item.position?.from && item.position?.to)}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button key="locate-highlight" type="link" size="small" onClick={() => onJumpToComment(item)}>
                    定位
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={<Typography.Text>{item.author?.username || '未知用户'}</Typography.Text>}
                  description={
                    <Space direction="vertical" size={2}>
                      <Typography.Text>{item.position?.selected_text || item.content}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {formatTime(item.created_at)}
                      </Typography.Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}

        {activeKey === 'search' && (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              全文检索（基础模式）
            </Typography.Text>
            <Input.Search
              allowClear
              placeholder="搜索标题、评论、目录..."
              onSearch={(value) => {
                const keyword = String(value || '').trim();
                if (!keyword) return;
                const target = comments.find((item) => item.content?.includes(keyword));
                if (target) {
                  onJumpToComment(target);
                  onActiveChange('comments');
                }
              }}
            />
            <Typography.Text strong style={{ fontSize: 12 }}>
              目录命中
            </Typography.Text>
            <List
              size="small"
              dataSource={outline}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无目录可检索" /> }}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text>{`H${item.level} ${item.text}`}</Typography.Text>
                </List.Item>
              )}
            />
            <Typography.Text strong style={{ fontSize: 12 }}>
              协作者
            </Typography.Text>
            <List
              size="small"
              dataSource={members}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无成员信息" /> }}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <Typography.Text>{item.username}</Typography.Text>
                    {roleTag(item.role)}
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        )}

      </Space>
    </div>
  );
}