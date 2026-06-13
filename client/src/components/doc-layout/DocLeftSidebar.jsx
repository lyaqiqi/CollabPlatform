import { useState } from 'react';
import { Tooltip } from 'antd';
import {
  CaretRightFilled,
  ClockCircleOutlined,
} from '@ant-design/icons';
import DocTree from './DocTree';
import { useTreeSync } from '../../hooks/useTreeSync';

function SectionHeader({ label, collapsed, onToggle }) {
  return (
    <div className="doc-left-sidebar__section-header" onClick={onToggle} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onToggle()}>
      <span>{label}</span>
      <CaretRightFilled
        style={{
          fontSize: 10,
          transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
          transition: 'transform 0.18s ease',
          color: 'var(--doc-text-4)',
        }}
      />
    </div>
  );
}

export default function DocLeftSidebar({
  outlineTree = [],
  onJumpToOutline,
  onOpenVersions,
  currentDocId,
  onSelectDoc,
}) {
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);

  // 订阅服务端树变更推送，保持文档树与所有标签页/会话实时同步
  useTreeSync();

  return (
    <div className="doc-left-sidebar">
      {/* ── 目录树 ── */}
      <div className="doc-left-sidebar__section">
        <SectionHeader
          label="目录"
          collapsed={outlineCollapsed}
          onToggle={() => setOutlineCollapsed((p) => !p)}
        />
        <div
          className={`doc-left-sidebar__section-content${outlineCollapsed ? ' doc-left-sidebar__section-content--collapsed' : ''}`}
          style={{ maxHeight: outlineCollapsed ? 0 : '40vh' }}
        >
          <div className="doc-outline" style={{ overflowY: 'auto', maxHeight: '40vh' }}>
            {outlineTree.length === 0 ? (
              <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--doc-text-3)' }}>
                正文中添加标题后将在此显示
              </div>
            ) : (
              outlineTree.map((item) => (
                <div
                  key={item.id}
                  className={`doc-outline-item doc-outline-item--h${item.level}`}
                  onClick={() => onJumpToOutline(item.pos)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onJumpToOutline(item.pos)}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--doc-text-4)',
                      minWidth: 14,
                      flexShrink: 0,
                    }}
                  >
                    H{item.level}
                  </span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── 知识库（文档树/文件夹） ── */}
      <div className="doc-left-sidebar__section" style={{ marginTop: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <DocTree currentDocId={currentDocId} onSelectDoc={onSelectDoc} />
      </div>

      {/* ── 底部：历史记录入口 ── */}
      <div className="doc-left-sidebar__footer">
        <Tooltip title="查看所有版本快照" placement="right">
          <div
            className="doc-sidebar-list-item"
            style={{ borderRadius: 'var(--doc-radius-sm)', padding: '6px 8px' }}
            onClick={onOpenVersions}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onOpenVersions()}
          >
            <ClockCircleOutlined style={{ color: 'var(--doc-text-3)', fontSize: 14 }} />
            <span style={{ fontSize: 13, color: 'var(--doc-text-2)' }}>历史记录</span>
          </div>
        </Tooltip>
      </div>
    </div>
  );
}
