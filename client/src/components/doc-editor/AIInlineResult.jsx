import { Button } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  LoadingOutlined,
  PlusOutlined,
  RedoOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { AI_ACTIONS } from './AIBubbleActions';

const ACTION_LABELS = AI_ACTIONS.reduce((acc, a) => {
  acc[a.key] = a.label;
  return acc;
}, {});

/**
 * 内联 AI 结果浮层（固定在编辑区底部居中）。
 * 流式展示生成内容，并提供 替换 / 插入到后方 / 重新生成 / 丢弃 操作。
 */
export default function AIInlineResult({ state, onAccept, onInsertAfter, onRetry, onDismiss }) {
  const { visible, loading, result, action } = state;
  if (!visible) return null;

  return (
    <div className="ai-inline-result">
      <div className="ai-inline-result__header">
        <span className="ai-inline-result__title">
          <RobotOutlined style={{ marginRight: 6 }} />
          AI · {ACTION_LABELS[action] || '助手'}
        </span>
        {loading && <LoadingOutlined style={{ color: 'var(--doc-brand, #3370ff)' }} />}
        <button type="button" className="ai-inline-result__close" onClick={onDismiss} aria-label="关闭">
          <CloseOutlined />
        </button>
      </div>

      <div className="ai-inline-result__body">
        {result || <span className="ai-inline-result__placeholder">正在生成…</span>}
      </div>

      {!loading && result && (
        <div className="ai-inline-result__actions">
          <Button type="primary" size="small" icon={<CheckOutlined />} onClick={onAccept}>
            替换选中
          </Button>
          <Button size="small" icon={<PlusOutlined />} onClick={onInsertAfter}>
            插入到后方
          </Button>
          <Button size="small" icon={<RedoOutlined />} onClick={onRetry}>
            重新生成
          </Button>
          <Button size="small" danger type="text" onClick={onDismiss}>
            丢弃
          </Button>
        </div>
      )}
    </div>
  );
}
