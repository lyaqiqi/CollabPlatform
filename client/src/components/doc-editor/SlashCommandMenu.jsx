import { useCallback, useEffect, useRef, useState } from 'react';

const COMMAND_GROUPS = [
  {
    group: '文本',
    items: [
      { key: 'paragraph', icon: '¶', name: '正文', desc: '普通段落文本', run: (e) => e.chain().focus().setParagraph().run() },
      { key: 'h1', icon: 'H1', name: '标题 1', desc: '大号章节标题', run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
      { key: 'h2', icon: 'H2', name: '标题 2', desc: '中等节标题', run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
      { key: 'h3', icon: 'H3', name: '标题 3', desc: '小节标题', run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
    ],
  },
  {
    group: '列表',
    items: [
      { key: 'bullet', icon: '•', name: '无序列表', desc: '项目符号列表', run: (e) => e.chain().focus().toggleBulletList().run() },
      { key: 'ordered', icon: '1.', name: '有序列表', desc: '编号列表', run: (e) => e.chain().focus().toggleOrderedList().run() },
      { key: 'task', icon: '☑', name: '待办事项', desc: '可勾选的任务列表', run: (e) => e.chain().focus().toggleTaskList().run() },
    ],
  },
  {
    group: '内容块',
    items: [
      { key: 'quote', icon: '"', name: '引用块', desc: '引用他人观点', run: (e) => e.chain().focus().toggleBlockquote().run() },
      { key: 'code', icon: '</>', name: '代码块', desc: '多行代码（支持语法高亮）', run: (e) => e.chain().focus().toggleCodeBlock().run() },
      { key: 'divider', icon: '—', name: '分割线', desc: '视觉分隔内容', run: (e) => e.chain().focus().setHorizontalRule().run() },
    ],
  },
  {
    group: '媒体与表格',
    items: [
      {
        key: 'table',
        icon: '⊞',
        name: '表格',
        desc: '插入 3×3 表格',
        run: (e) =>
          e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      {
        key: 'image-url',
        icon: '🖼',
        name: '图片（URL）',
        desc: '通过网络地址插入图片',
        run: (e) => {
          const url = window.prompt('输入图片 URL', 'https://');
          if (url) e.chain().focus().setImage({ src: url }).run();
        },
      },
      {
        key: 'image-upload',
        icon: '⬆',
        name: '图片（上传）',
        desc: '从本地上传图片（转 base64）',
        run: (e) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              const src = ev.target?.result;
              if (src) e.chain().focus().setImage({ src }).run();
            };
            reader.readAsDataURL(file);
          };
          input.click();
        },
      },
    ],
  },
];

const ALL_ITEMS = COMMAND_GROUPS.flatMap((g) => g.items);

export default function SlashCommandMenu({ open, position, from, editor, onClose }) {
  const [filter, setFilter] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const activeRef = useRef(null);

  const filteredGroups = filter.trim()
    ? [{
        group: '搜索结果',
        items: ALL_ITEMS.filter(
          (item) =>
            item.name.toLowerCase().includes(filter.toLowerCase()) ||
            item.key.includes(filter.toLowerCase())
        ),
      }]
    : COMMAND_GROUPS;

  const flatItems = filteredGroups.flatMap((g) => g.items);

  useEffect(() => { setActiveIndex(0); }, [open, filter]);

  useEffect(() => {
    if (!open || !editor) return;
    const sync = () => {
      const { $from } = editor.state.selection;
      const blockStart = $from.start();
      const textBefore = editor.state.doc.textBetween(blockStart, $from.pos, '\n', '\0');
      const match = textBefore.match(/^\/(.*)$/);
      setFilter(match ? match[1] : '');
    };
    editor.on('update', sync);
    editor.on('selectionUpdate', sync);
    sync();
    return () => {
      editor.off('update', sync);
      editor.off('selectionUpdate', sync);
    };
  }, [open, editor]);

  const execItem = useCallback(
    (item) => {
      if (!editor) return;
      if (from != null) {
        editor.chain().focus().deleteRange({ from, to: editor.state.selection.from }).run();
      }
      item.run(editor);
      onClose();
    },
    [editor, from, onClose]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation();
        setActiveIndex((i) => (i + 1) % Math.max(flatItems.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        setActiveIndex((i) => (i - 1 + Math.max(flatItems.length, 1)) % Math.max(flatItems.length, 1));
      } else if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation();
        if (flatItems[activeIndex]) execItem(flatItems[activeIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, flatItems, activeIndex, execItem, onClose]);

  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest' }); }, [activeIndex]);

  if (!open) return null;

  let globalIdx = 0;

  return (
    <div className="slash-menu" style={{ left: position.left, top: position.top }}>
      {flatItems.length === 0 ? (
        <div className="slash-menu__empty">没有匹配的命令</div>
      ) : (
        filteredGroups.map((group, gi) => (
          <div key={group.group}>
            <div className="slash-menu__group-label">{group.group}</div>
            {group.items.map((item) => {
              const idx = globalIdx++;
              const isActive = idx === activeIndex;
              return (
                <div
                  key={item.key}
                  ref={isActive ? activeRef : null}
                  className={`slash-menu__item${isActive ? ' slash-menu__item--active' : ''}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => execItem(item)}
                >
                  <div className="slash-menu__icon">{item.icon}</div>
                  <div className="slash-menu__text">
                    <div className="slash-menu__name">{item.name}</div>
                    <div className="slash-menu__desc">{item.desc}</div>
                  </div>
                </div>
              );
            })}
            {gi < filteredGroups.length - 1 && <div className="slash-menu__divider" />}
          </div>
        ))
      )}
    </div>
  );
}
