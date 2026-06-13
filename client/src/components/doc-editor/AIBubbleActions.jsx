import { Dropdown, Tooltip } from 'antd';
import { LoadingOutlined, RobotOutlined } from '@ant-design/icons';

/** AI 动作清单（key 与后端 ACTION_PROMPTS 对应）。供气泡菜单与斜杠命令共用。 */
export const AI_ACTIONS = [
  { key: 'improve', label: '✨ 优化写作' },
  { key: 'fix_grammar', label: '🩹 修正语法' },
  { key: 'summarize', label: '📝 生成摘要' },
  { key: 'explain', label: '💡 解释内容' },
  { key: 'expand', label: '📖 扩写内容' },
  { key: 'shorten', label: '✂️ 精简内容' },
  { key: 'continue', label: '➡️ 续写' },
  { key: 'translate_en', label: '🇬🇧 翻译为英文' },
  { key: 'translate_zh', label: '🇨🇳 翻译为中文' },
];

/**
 * 选区气泡菜单中的 AI 入口。点击展开动作下拉，选择后触发 onAction(actionKey)。
 */
export default function AIBubbleActions({ onAction, loading }) {
  const items = AI_ACTIONS.map(({ key, label }) => ({
    key,
    label,
    onClick: () => onAction?.(key),
  }));

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomLeft" overlayStyle={{ zIndex: 9999 }}>
      <Tooltip title="AI 助手" placement="top" mouseEnterDelay={0.6}>
        <button
          type="button"
          className="selection-bubble__btn selection-bubble__btn--ai"
          onMouseDown={(e) => e.preventDefault()}
        >
          {loading ? <LoadingOutlined /> : <RobotOutlined />}
          <span style={{ marginLeft: 4 }}>AI</span>
        </button>
      </Tooltip>
    </Dropdown>
  );
}
