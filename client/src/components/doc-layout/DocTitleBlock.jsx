import { useEffect, useRef, useState } from 'react';
import { Tooltip } from 'antd';
import {
  DeleteOutlined,
  PictureOutlined,
  RedoOutlined,
  SmileOutlined,
  UndoOutlined,
} from '@ant-design/icons';

const QUICK_EMOJI = [
  '📄', '📝', '📋', '📌', '🔖', '💡',
  '🚀', '⭐', '🎯', '🛠️', '📊', '🔍',
  '📁', '🗒️', '🧩', '🎨', '🌐', '💬',
];

export default function DocTitleBlock({
  title,
  onTitleChange,
  onTitleBlur,
  saving,
  connected,
  undoManager,
}) {
  const textareaRef = useRef(null);
  const pickerWrapRef = useRef(null);
  const [emoji, setEmoji] = useState('📄');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  /* textarea 高度自动撑开 */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [title]);

  /* 点击外部关闭 picker */
  useEffect(() => {
    if (!emojiPickerOpen) return;
    const close = (e) => {
      if (!pickerWrapRef.current?.contains(e.target)) {
        setEmojiPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [emojiPickerOpen]);

  const hasIcon = Boolean(emoji);

  return (
    <div
      className="doc-title-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── 操作行（hover 时显示，仅在无图标时展示"添加图标"） ── */}
      {!hasIcon && (
        <div className={`doc-title-block__actions${hovered ? ' doc-title-block__actions--visible' : ''}`}>
          <Tooltip title="为文档添加图标" placement="top">
            <button
              type="button"
              className="doc-title-block__action-btn"
              onClick={() => setEmoji('📄')}
            >
              <SmileOutlined />
              添加图标
            </button>
          </Tooltip>
          <Tooltip title="添加封面图（暂未开放）" placement="top">
            <button type="button" className="doc-title-block__action-btn" disabled>
              <PictureOutlined />
              添加封面
            </button>
          </Tooltip>
        </div>
      )}

      {/* ── 主体行：图标 + 标题 ── */}
      <div className="doc-title-block__main">
        {/* 图标区域 */}
        {hasIcon && (
          <div className="doc-title-block__icon-col" ref={pickerWrapRef}>
            <Tooltip title="点击更换图标" placement="left" mouseEnterDelay={0.8}>
              <span
                className="doc-title-block__icon"
                onClick={() => setEmojiPickerOpen((p) => !p)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setEmojiPickerOpen((p) => !p)}
              >
                {emoji}
              </span>
            </Tooltip>

            {/* emoji 选择浮层 */}
            {emojiPickerOpen && (
              <div className="doc-title-block__emoji-picker">
                <div className="doc-title-block__emoji-grid">
                  {QUICK_EMOJI.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className={`doc-title-block__emoji-option${emoji === e ? ' doc-title-block__emoji-option--active' : ''}`}
                      onClick={() => { setEmoji(e); setEmojiPickerOpen(false); }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <div className="doc-title-block__emoji-footer">
                  <button
                    type="button"
                    className="doc-title-block__emoji-remove"
                    onClick={() => { setEmoji(null); setEmojiPickerOpen(false); }}
                  >
                    <DeleteOutlined style={{ marginRight: 5 }} />
                    移除图标
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 标题输入 */}
        <div className="doc-title-block__title-col">
          <textarea
            ref={textareaRef}
            className="doc-title-block__title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onTitleBlur}
            placeholder="无标题"
            rows={1}
            spellCheck={false}
          />
        </div>
      </div>

      {/* ── 工具栏：撤销/重做 + 状态 ── */}
      <div className="doc-title-block__toolbar">
        {undoManager && (
          <div className="doc-toolbar">
            <Tooltip title="撤销 (Ctrl+Z)" placement="bottom">
              <button type="button" className="doc-toolbar__btn" onClick={() => undoManager.undo()}>
                <UndoOutlined />
              </button>
            </Tooltip>
            <Tooltip title="重做 (Ctrl+Shift+Z)" placement="bottom">
              <button type="button" className="doc-toolbar__btn" onClick={() => undoManager.redo()}>
                <RedoOutlined />
              </button>
            </Tooltip>
          </div>
        )}

        <div className="doc-title-block__meta">
          <span className={`doc-title-block__status-dot${connected ? ' doc-title-block__status-dot--on' : ''}`} />
          <span className="doc-title-block__status-text">
            {saving ? '保存中…' : connected ? '协作中' : '连接中…'}
          </span>
        </div>
      </div>
    </div>
  );
}
