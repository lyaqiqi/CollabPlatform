import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Collaboration from '@tiptap/extension-collaboration';
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
import * as Y from 'yjs';
import { applyPersistedYjsState } from '../../collab/yjsUtils';
import '../../styles/doc-editor.css';

const lowlight = createLowlight(all);

/**
 * 只读 TipTap 编辑器，用于在版本预览 Modal 中渲染历史快照。
 * 接收 Base64 编码的 yjs_state，将其应用到临时 Y.Doc 后展示富文本内容。
 *
 * @param {{ yjsState?: string }} props
 */
export default function VersionPreviewEditor({ yjsState }) {
  const tempYdoc = useMemo(() => {
    const doc = new Y.Doc();
    applyPersistedYjsState(doc, yjsState);
    return doc;
    // yjsState 变化时重新创建临时 Y.Doc（每次打开不同版本）
  }, [yjsState]);

  const editor = useEditor(
    {
      editable: false,
      extensions: [
        StarterKit.configure({ history: false, codeBlock: false }),
        Highlight,
        Collaboration.configure({ document: tempYdoc }),
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
        Image.configure({ inline: false, allowBase64: true }),
        TaskList,
        TaskItem.configure({ nested: true }),
        CodeBlockLowlight.configure({ lowlight }),
        Link.configure({ openOnClick: true }),
        TextStyle,
        Color,
      ],
      editorProps: {
        attributes: { class: 'doc-editor__content' },
      },
    },
    [tempYdoc],
  );

  useEffect(
    () => () => {
      editor?.destroy();
      tempYdoc.destroy();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tempYdoc],
  );

  if (!editor) return null;

  return (
    <div className="doc-editor doc-editor--immersive doc-editor--readonly">
      <EditorContent editor={editor} />
    </div>
  );
}
