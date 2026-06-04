import { useRef, useState } from 'react';
import { BubbleMenu } from '@tiptap/react';
import {
  BoldOutlined,
  CodeOutlined,
  FontColorsOutlined,
  ItalicOutlined,
  LinkOutlined,
  MessageOutlined,
  StrikethroughOutlined,
} from '@ant-design/icons';
import { Input, Modal, Popover, Tooltip } from 'antd';

/* ── 预设文字颜色色板 ── */
const TEXT_COLORS = [
  { label: '默认', value: null },
  { label: '红色', value: '#f54a45' },
  { label: '橙色', value: '#f5803e' },
  { label: '黄色', value: '#f5a623' },
  { label: '绿色', value: '#2ea121' },
  { label: '蓝色', value: '#3370ff' },
  { label: '紫色', value: '#ad4ef5' },
  { label: '灰色', value: '#8f959e' },
];

/* ── 预设高亮背景色 ── */
const HIGHLIGHT_COLORS = [
  { label: '无', value: null },
  { label: '黄色', value: 'rgba(255, 211, 61, 0.4)' },
  { label: '绿色', value: 'rgba(46, 161, 33, 0.2)' },
  { label: '蓝色', value: 'rgba(51, 112, 255, 0.15)' },
  { label: '红色', value: 'rgba(245, 74, 69, 0.15)' },
  { label: '紫色', value: 'rgba(173, 78, 245, 0.15)' },
];

function BubbleBtn({ title, onClick, active, className = '', children }) {
  return (
    <Tooltip title={title} placement="top" mouseEnterDelay={0.6}>
      <button
        type="button"
        className={`selection-bubble__btn${active ? ' selection-bubble__btn--active' : ''} ${className}`}
        onMouseDown={(e) => { e.preventDefault(); onClick?.(); }}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/* ── 颜色选择弹出框 ── */
function ColorPicker({ editor }) {
  const [open, setOpen] = useState(false);

  const content = (
    <div style={{ width: 200 }}>
      <div style={{ fontSize: 11, color: '#8f959e', marginBottom: 4, fontWeight: 600 }}>文字颜色</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {TEXT_COLORS.map((c) => (
          <Tooltip key={c.label} title={c.label} placement="top">
            <button
              type="button"
              style={{
                width: 20, height: 20, borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                background: c.value ?? '#fff',
                border: c.value ? '1px solid rgba(0,0,0,0.08)' : '1px solid #dee0e3',
                fontWeight: 700, fontSize: 11, color: c.value ?? '#1f2329',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                if (c.value) {
                  editor.chain().focus().setColor(c.value).run();
                } else {
                  editor.chain().focus().unsetColor().run();
                }
                setOpen(false);
              }}
            >
              A
            </button>
          </Tooltip>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#8f959e', marginBottom: 4, fontWeight: 600 }}>背景高亮</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {HIGHLIGHT_COLORS.map((c) => (
          <Tooltip key={c.label} title={c.label} placement="top">
            <button
              type="button"
              style={{
                width: 20, height: 20, borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                background: c.value ?? '#fff',
                border: '1px solid rgba(0,0,0,0.08)',
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                if (c.value) {
                  editor.chain().focus().toggleHighlight({ color: c.value }).run();
                } else {
                  editor.chain().focus().unsetHighlight().run();
                }
                setOpen(false);
              }}
            />
          </Tooltip>
        ))}
      </div>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      content={content}
      trigger="click"
      placement="bottom"
      overlayStyle={{ zIndex: 9999 }}
    >
      <Tooltip title="文字颜色" placement="top" mouseEnterDelay={0.6}>
        <button
          type="button"
          className="selection-bubble__btn"
          onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        >
          <FontColorsOutlined />
        </button>
      </Tooltip>
    </Popover>
  );
}

export default function SelectionBubbleMenu({ editor, onCreateComment }) {
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const savedRangeRef = useRef(null);

  if (!editor) return null;

  const handleOpenLinkModal = () => {
    const { from, to, empty } = editor.state.selection;
    if (empty) return;
    // 保存当前选区位置（modal 打开后编辑器会失焦）
    savedRangeRef.current = { from, to };
    setLinkUrl(editor.isActive('link') ? (editor.getAttributes('link').href ?? 'https://') : 'https://');
    setLinkModalOpen(true);
  };

  const handleLinkOk = () => {
    const range = savedRangeRef.current;
    if (!range) { setLinkModalOpen(false); return; }
    const url = linkUrl.trim();
    if (url && url !== 'https://') {
      editor
        .chain()
        .focus()
        .setTextSelection(range)
        .setLink({ href: url, target: '_blank' })
        .run();
    }
    setLinkModalOpen(false);
    savedRangeRef.current = null;
  };

  const handleUnsetLink = () => {
    editor.chain().focus().unsetLink().run();
  };

  return (
    <>
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: [100, 80], placement: 'top' }}
        shouldShow={({ editor: e }) => !e.state.selection.empty}
      >
        <div className="selection-bubble">
          <BubbleBtn title="加粗 (Ctrl+B)" active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}>
            <BoldOutlined />
          </BubbleBtn>

          <BubbleBtn title="斜体 (Ctrl+I)" active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}>
            <ItalicOutlined />
          </BubbleBtn>

          <BubbleBtn title="删除线" active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}>
            <StrikethroughOutlined />
          </BubbleBtn>

          <BubbleBtn title="行内代码" active={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}>
            <CodeOutlined />
          </BubbleBtn>

          <ColorPicker editor={editor} />

          {editor.isActive('link') ? (
            <BubbleBtn title="移除链接" active onClick={handleUnsetLink}>
              <LinkOutlined />
            </BubbleBtn>
          ) : (
            <BubbleBtn title="插入链接" onClick={handleOpenLinkModal}>
              <LinkOutlined />
            </BubbleBtn>
          )}

          <div className="selection-bubble__sep" />

          <button
            type="button"
            className="selection-bubble__btn selection-bubble__btn--comment"
            onMouseDown={(e) => { e.preventDefault(); onCreateComment?.(); }}
          >
            <MessageOutlined style={{ marginRight: 4 }} />
            评论
          </button>
        </div>
      </BubbleMenu>

      {/* 链接插入 Modal — 在编辑器失焦后仍能正确恢复选区 */}
      <Modal
        title="插入链接"
        open={linkModalOpen}
        onOk={handleLinkOk}
        onCancel={() => { setLinkModalOpen(false); savedRangeRef.current = null; }}
        okText="确认"
        cancelText="取消"
        width={400}
        destroyOnClose
      >
        <Input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://example.com"
          onPressEnter={handleLinkOk}
          autoFocus
          style={{ marginTop: 8 }}
        />
      </Modal>
    </>
  );
}
