import { Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  ExportOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  RobotOutlined,
  SearchOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';

function avatarColor(name) {
  const COLORS = ['#3370ff', '#07c160', '#f5803e', '#ad4ef5', '#00bcd4', '#e040fb'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

export default function DocImmersiveHeader({
  title,
  onlineUsers = [],
  onToggleLeft,
  leftCollapsed,
  onOpenComments,
  onOpenVersions,
  onOpenSearch,
  onShare,
  onExport,
}) {
  const displayed = onlineUsers.slice(0, 6);
  const extra = onlineUsers.length - displayed.length;

  return (
    <div className="doc-header">
      <div className="doc-header__left">
        <Tooltip title={leftCollapsed ? '展开目录' : '收起目录'} placement="bottom">
          <button className="doc-icon-btn" onClick={onToggleLeft} type="button">
            {leftCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        </Tooltip>

        <div className="doc-header__breadcrumb">
          <span>知识库</span>
          <span className="doc-header__breadcrumb-sep">/</span>
          <span>协作文档</span>
          <span className="doc-header__breadcrumb-sep">/</span>
          <span
            style={{
              color: 'var(--doc-text-2)',
              fontWeight: 500,
              maxWidth: 220,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'inline-block',
              verticalAlign: 'middle',
            }}
          >
            {title || '未命名文档'}
          </span>
        </div>
      </div>

      <div className="doc-header__right">
        {displayed.length > 0 && (
          <div className="doc-avatar-group">
            {displayed.map((item, i) => (
              <Tooltip
                key={`${item.name}-${i}`}
                title={item.isSelf ? `${item.name}（你）` : item.name}
                placement="bottom"
              >
                <div
                  className="doc-avatar"
                  style={{
                    background: item.color || avatarColor(item.name),
                    boxShadow: item.isSelf ? '0 0 0 2px var(--doc-brand)' : undefined,
                  }}
                >
                  {(item.name || 'U').slice(0, 1).toUpperCase()}
                  <span className="doc-avatar__online-dot" />
                </div>
              </Tooltip>
            ))}
            {extra > 0 && (
              <Tooltip title={`还有 ${extra} 人在线`} placement="bottom">
                <div className="doc-avatar doc-avatar--extra">+{extra}</div>
              </Tooltip>
            )}
          </div>
        )}

        <div className="doc-header-divider" />

        <Tooltip title="评论" placement="bottom">
          <button className="doc-icon-btn" onClick={onOpenComments} type="button">
            <MessageOutlined />
          </button>
        </Tooltip>

        <Tooltip title="版本历史" placement="bottom">
          <button className="doc-icon-btn" onClick={onOpenVersions} type="button">
            <ClockCircleOutlined />
          </button>
        </Tooltip>

        <Tooltip title="全文搜索" placement="bottom">
          <button className="doc-icon-btn" onClick={onOpenSearch} type="button">
            <SearchOutlined />
          </button>
        </Tooltip>

        <div className="doc-header-divider" />

        <Tooltip title="复制分享链接" placement="bottom">
          <button className="doc-icon-btn" onClick={onShare} type="button">
            <ShareAltOutlined />
          </button>
        </Tooltip>

        <Tooltip title="导出文档" placement="bottom">
          <button className="doc-icon-btn" onClick={onExport} type="button">
            <ExportOutlined />
          </button>
        </Tooltip>

        <button className="doc-icon-btn doc-icon-btn--primary" type="button">
          <RobotOutlined />
          AI 助手
        </button>
      </div>
    </div>
  );
}
