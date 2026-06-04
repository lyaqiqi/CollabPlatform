import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Link from '@tiptap/extension-link';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { all, createLowlight } from 'lowlight';
import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import SelectionBubbleMenu from './doc-editor/SelectionBubbleMenu';
import SlashCommandMenu from './doc-editor/SlashCommandMenu';
import TableBubbleMenu from './doc-editor/TableBubbleMenu';
import '../styles/doc-editor.css';

const lowlight = createLowlight(all);

/**
 * 评论锚点高亮装饰。
 * 优先用存储的 from/to 定位；若正文内容已变动导致位置漂移，
 * 则降级到遍历文本节点用 selected_text 重新匹配定位。
 */
function buildCommentAnchorExtension(anchors, activeCommentId) {
  return Extension.create({
    name: 'commentAnchorHighlights',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            decorations(state) {
              const decs = [];
              const docSize = state.doc.content.size;

              anchors.forEach((anchor) => {
                let from = Number(anchor?.position?.from);
                let to = Number(anchor?.position?.to);
                const selectedText = anchor?.position?.selected_text || '';

                // 验证存储位置是否仍与文本对齐
                const posValid =
                  Number.isFinite(from) &&
                  Number.isFinite(to) &&
                  from >= 1 &&
                  to > from &&
                  to <= docSize;

                if (posValid && selectedText) {
                  try {
                    const currentText = state.doc.textBetween(from, to, ' ');
                    if (currentText.trim() !== selectedText.trim()) {
                      // 位置漂移：尝试在文本节点中重新查找
                      let found = null;
                      state.doc.descendants((node, pos) => {
                        if (found || !node.isText) return;
                        const idx = node.text.indexOf(selectedText);
                        if (idx !== -1) {
                          found = { from: pos + idx, to: pos + idx + selectedText.length };
                        }
                      });
                      if (found) {
                        from = found.from;
                        to = found.to;
                      } else {
                        return; // 文本已被删除，跳过此锚点
                      }
                    }
                  } catch {
                    return;
                  }
                } else if (!posValid) {
                  if (!selectedText) return;
                  // 无有效位置，直接文本搜索
                  let found = null;
                  state.doc.descendants((node, pos) => {
                    if (found || !node.isText) return;
                    const idx = node.text.indexOf(selectedText);
                    if (idx !== -1) {
                      found = { from: pos + idx, to: pos + idx + selectedText.length };
                    }
                  });
                  if (!found) return;
                  from = found.from;
                  to = found.to;
                }

                const safeFrom = Math.max(1, Math.min(from, docSize));
                const safeTo = Math.max(safeFrom + 1, Math.min(to, docSize));
                if (safeTo <= safeFrom) return;

                const cls =
                  anchor.comment_id === activeCommentId
                    ? 'doc-comment-anchor doc-comment-anchor--active'
                    : 'doc-comment-anchor';
                decs.push(
                  Decoration.inline(safeFrom, safeTo, {
                    class: cls,
                    'data-comment-id': anchor.comment_id,
                  })
                );
              });
              return DecorationSet.create(state.doc, decs);
            },
          },
        }),
      ];
    },
  });
}

/** 协作撤销/重做 Extension — 将 Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y 委托给 Y.UndoManager */
function buildUndoExtension(undoManager) {
  return Extension.create({
    name: 'collabUndo',
    addKeyboardShortcuts() {
      return {
        'Mod-z': () => {
          if (!undoManager) return false;
          undoManager.undo();
          return true;
        },
        'Mod-Shift-z': () => {
          if (!undoManager) return false;
          undoManager.redo();
          return true;
        },
        'Mod-y': () => {
          if (!undoManager) return false;
          undoManager.redo();
          return true;
        },
      };
    },
  });
}

const DocEditor = forwardRef(function DocEditor(
  {
    ydoc,
    provider,
    user,
    color,
    undoManager,
    onSelectionChange,
    commentAnchors = [],
    activeCommentId = null,
    onCreateCommentFromSelection,
    onDocumentOutlineChange,
  },
  ref
) {
  const [slashMenu, setSlashMenu] = useState({ open: false, left: 0, top: 0, from: null });

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false, codeBlock: false }),
        Highlight,
        Placeholder.configure({
          placeholder: ({ node }) => {
            if (node.type.name === 'heading') return '标题';
            return "键入 '/' 插入内容…";
          },
        }),
        buildCommentAnchorExtension(commentAnchors, activeCommentId),
        buildUndoExtension(undoManager),
        Collaboration.configure({ document: ydoc }),
        CollaborationCursor.configure({
          provider,
          user: { name: user.username, color },
        }),
        // 表格
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        // 图片
        Image.configure({ inline: false, allowBase64: true }),
        // 待办事项
        TaskList,
        TaskItem.configure({ nested: true }),
        // 代码块语法高亮（替换 StarterKit 内置 codeBlock）
        CodeBlockLowlight.configure({ lowlight }),
        // 链接
        Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
        // 文字颜色（TextStyle 是 Color 的依赖）
        TextStyle,
        Color,
      ],
      editorProps: {
        attributes: { class: 'doc-editor__content' },
      },
      onUpdate: ({ editor: e }) => {
        if (typeof onDocumentOutlineChange !== 'function') return;
        const outline = [];
        e.state.doc.descendants((node, pos) => {
          if (node.type.name !== 'heading') return;
          outline.push({
            id: `${pos}-${node.attrs.level}`,
            level: node.attrs.level,
            text: node.textContent || `标题 ${node.attrs.level}`,
            pos,
          });
        });
        onDocumentOutlineChange(outline);
      },
    },
    [ydoc, provider, user.user_id, user.username, color, undoManager, commentAnchors, activeCommentId]
  );

  /* 选区变化通知父组件 */
  useEffect(() => {
    if (!editor || typeof onSelectionChange !== 'function') return undefined;
    const notify = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty) { onSelectionChange(null); return; }
      onSelectionChange({ from, to, text: editor.state.doc.textBetween(from, to, ' ').trim() });
    };
    editor.on('selectionUpdate', notify);
    notify();
    return () => editor.off('selectionUpdate', notify);
  }, [editor, onSelectionChange]);

  /* 斜杠命令触发检测 */
  useEffect(() => {
    if (!editor) return undefined;
    const check = () => {
      const { empty, $from } = editor.state.selection;
      if (!empty) { setSlashMenu((p) => ({ ...p, open: false })); return; }
      const blockStart = $from.start();
      const textBefore = editor.state.doc.textBetween(blockStart, $from.pos, '\n', '\0');
      if (!/^\/[\w\u4e00-\u9fa5-]*$/.test(textBefore)) {
        setSlashMenu((p) => ({ ...p, open: false }));
        return;
      }
      const coords = editor.view.coordsAtPos($from.pos);
      setSlashMenu({ open: true, left: coords.left, top: coords.bottom + 6, from: $from.pos - textBefore.length });
    };
    editor.on('selectionUpdate', check);
    editor.on('update', check);
    check();
    return () => { editor.off('selectionUpdate', check); editor.off('update', check); };
  }, [editor]);

  /* 销毁编辑器 */
  useEffect(() => () => { editor?.destroy(); }, [editor]);

  useImperativeHandle(ref, () => ({
    getCurrentSelection: () => {
      if (!editor) return null;
      const { from, to, empty } = editor.state.selection;
      if (empty) return null;
      return { from, to, text: editor.state.doc.textBetween(from, to, ' ').trim() };
    },
    jumpToPosition: (position) => {
      if (!editor || !position) return;
      const from = Number(position.from);
      const to = Number(position.to);
      if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < from) return;
      editor.chain().focus().setTextSelection({ from, to }).run();
    },
    /** 返回文档纯文本（用于外部全文搜索） */
    getDocumentText: () => editor?.state.doc.textContent ?? '',
    /**
     * 在文档中查找关键词，返回所有命中位置数组。
     * 只在单个文本节点内匹配（覆盖绝大多数场景）。
     * @returns {{ from: number, to: number, text: string }[]}
     */
    findInDocument: (keyword) => {
      if (!editor || !keyword.trim()) return [];
      const results = [];
      editor.state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        const lk = keyword.toLowerCase();
        const lt = node.text.toLowerCase();
        let idx = lt.indexOf(lk);
        while (idx !== -1) {
          results.push({
            from: pos + idx,
            to: pos + idx + keyword.length,
            text: node.text.slice(idx, idx + keyword.length),
          });
          idx = lt.indexOf(lk, idx + 1);
          if (results.length >= 50) return false; // 截断
        }
      });
      return results;
    },
    /** 高亮并滚动到指定位置 */
    highlightAndJump: (from, to) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection({ from, to }).run();
    },
    /** 返回文档 HTML（用于导出） */
    getHTML: () => editor?.getHTML() ?? '',
    /** 返回文档 JSON（用于调试） */
    getJSON: () => editor?.getJSON() ?? null,
  }), [editor]);

  if (!editor) return null;

  return (
    <div className="doc-editor doc-editor--immersive">
      <SelectionBubbleMenu
        editor={editor}
        onCreateComment={onCreateCommentFromSelection}
      />

      <TableBubbleMenu editor={editor} />

      <EditorContent editor={editor} />

      <SlashCommandMenu
        open={slashMenu.open}
        position={{ left: slashMenu.left, top: slashMenu.top }}
        from={slashMenu.from}
        editor={editor}
        onClose={() => setSlashMenu((p) => ({ ...p, open: false }))}
      />
    </div>
  );
});

export default DocEditor;
