import { useState } from 'react';
import { Tooltip } from 'antd';
import {
  CaretRightFilled,
  ClockCircleOutlined,
  FileTextOutlined,
  FolderOutlined,
} from '@ant-design/icons';

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

export default function DocLeftSidebar({ outlineTree = [], onJumpToOutline, onOpenVersions }) {
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);
  const [kbCollapsed, setKbCollapsed] = useState(false);
  const [relatedCollapsed, setRelatedCollapsed] = useState(false);

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

      {/* ── 知识库层级 ── */}
      <div className="doc-left-sidebar__section" style={{ marginTop: 8 }}>
        <SectionHeader
          label="知识库"
          collapsed={kbCollapsed}
          onToggle={() => setKbCollapsed((p) => !p)}
        />
        <div
          className={`doc-left-sidebar__section-content${kbCollapsed ? ' doc-left-sidebar__section-content--collapsed' : ''}`}
          style={{ maxHeight: kbCollapsed ? 0 : 200 }}
        >
          {['团队规范', '产品方案', '迭代计划'].map((name) => (
            <div key={name} className="doc-sidebar-list-item">
              <FolderOutlined className="doc-sidebar-list-icon" />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 关联文档 ── */}
      <div className="doc-left-sidebar__section" style={{ marginTop: 8 }}>
        <SectionHeader
          label="关联文档"
          collapsed={relatedCollapsed}
          onToggle={() => setRelatedCollapsed((p) => !p)}
        />
        <div
          className={`doc-left-sidebar__section-content${relatedCollapsed ? ' doc-left-sidebar__section-content--collapsed' : ''}`}
          style={{ maxHeight: relatedCollapsed ? 0 : 200 }}
        >
          {['需求评审记录', '接口设计说明', '测试用例集'].map((name) => (
            <div key={name} className="doc-sidebar-list-item">
              <FileTextOutlined className="doc-sidebar-list-icon" />
              <span>{name}</span>
            </div>
          ))}
        </div>
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
