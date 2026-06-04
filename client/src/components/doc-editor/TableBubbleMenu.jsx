import { BubbleMenu } from '@tiptap/react';
import { Tooltip } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

function TBtn({ title, onClick, danger, children }) {
  return (
    <Tooltip title={title} placement="top" mouseEnterDelay={0.5}>
      <button
        type="button"
        className={`table-bubble__btn${danger ? ' table-bubble__btn--danger' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault(); // 防止编辑器失焦
          onClick();
        }}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/**
 * 当光标在表格内时显示的浮动工具栏，提供行列的增删操作。
 */
export default function TableBubbleMenu({ editor }) {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: [80, 60], placement: 'top', offset: [0, 8] }}
      shouldShow={({ editor: e }) => e.isActive('table')}
    >
      <div className="table-bubble">
        <span className="table-bubble__label">行</span>
        <TBtn title="在上方插入行" onClick={() => editor.chain().focus().addRowBefore().run()}>↑行</TBtn>
        <TBtn title="在下方插入行" onClick={() => editor.chain().focus().addRowAfter().run()}>↓行</TBtn>
        <TBtn title="删除当前行" danger onClick={() => editor.chain().focus().deleteRow().run()}>
          <DeleteOutlined style={{ fontSize: 11 }} /> 行
        </TBtn>

        <div className="table-bubble__sep" />

        <span className="table-bubble__label">列</span>
        <TBtn title="在左侧插入列" onClick={() => editor.chain().focus().addColumnBefore().run()}>←列</TBtn>
        <TBtn title="在右侧插入列" onClick={() => editor.chain().focus().addColumnAfter().run()}>→列</TBtn>
        <TBtn title="删除当前列" danger onClick={() => editor.chain().focus().deleteColumn().run()}>
          <DeleteOutlined style={{ fontSize: 11 }} /> 列
        </TBtn>

        <div className="table-bubble__sep" />

        <TBtn title="删除整张表格" danger onClick={() => editor.chain().focus().deleteTable().run()}>
          <DeleteOutlined style={{ fontSize: 11 }} /> 表格
        </TBtn>
      </div>
    </BubbleMenu>
  );
}
