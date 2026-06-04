/**
 * DocShell — CSS Grid 三栏布局容器
 * 通过修改 CSS 自定义属性实现左/右栏平滑展开收起（无遮罩、挤压正文）
 */
export default function DocShell({ leftCollapsed, rightOpen, header, left, center, right }) {
  return (
    <div
      className="doc-shell"
      style={{
        '--_left-w': leftCollapsed ? '0px' : 'var(--doc-left-w)',
        '--_right-w': rightOpen ? 'var(--doc-right-w)' : '0px',
      }}
    >
      <div className="doc-shell__header">{header}</div>
      <div className="doc-shell__left">{left}</div>
      <div className="doc-shell__center">{center}</div>
      <div className="doc-shell__right">{right}</div>
    </div>
  );
}
