import { useEffect, useRef } from 'react';
import { Button, Input } from 'antd';
import { ClearOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';

const SUGGESTIONS = ['总结这篇文档', '列出文档中的待办事项', '帮我润色文档结构', '提炼三个关键要点'];

/**
 * 右侧面板的 AI 对话视图。携带当前文档上下文进行问答。
 */
export default function DocAIPanel({
  messages = [],
  input,
  onInputChange,
  loading,
  onSend,
  onClear,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend?.(input);
    }
  };

  return (
    <div className="doc-ai-panel">
      <div className="doc-ai-panel__bar">
        <span className="doc-ai-panel__bar-title">
          <RobotOutlined style={{ marginRight: 6 }} />
          AI 助手
        </span>
        <Button
          type="text"
          size="small"
          icon={<ClearOutlined />}
          onClick={onClear}
          disabled={messages.length === 0}
          style={{ fontSize: 12, color: 'var(--doc-text-3)' }}
        >
          清空
        </Button>
      </div>

      <div className="doc-ai-panel__messages">
        {messages.length === 0 ? (
          <div className="doc-ai-panel__empty">
            <p className="doc-ai-panel__empty-text">
              我可以结合当前文档内容回答问题，或帮你创作与润色。
            </p>
            <div className="doc-ai-panel__suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="doc-ai-panel__suggestion"
                  onClick={() => onSend?.(s)}
                  disabled={loading}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`doc-ai-msg doc-ai-msg--${msg.role}`}>
              <div className="doc-ai-msg__bubble">{msg.content || '…'}</div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="doc-ai-panel__input">
        <Input.TextArea
          value={input}
          onChange={(e) => onInputChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="向 AI 提问…（Enter 发送，Shift+Enter 换行）"
          autoSize={{ minRows: 1, maxRows: 5 }}
          disabled={loading}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={loading}
          disabled={!input?.trim()}
          onClick={() => onSend?.(input)}
        />
      </div>
    </div>
  );
}
