import { useCallback, useEffect, useRef, useState } from 'react';
import { aiActionStream, aiChatStream } from '../api/ai.api';

/**
 * 文档 AI 助手 hook。
 *
 * 同时管理两类能力：
 *  1. 内联动作（inlineState）：基于选中文本的改写/翻译/总结等，结果在浮层中预览，
 *     用户确认后才写回编辑器（保证 AI 结果只在"接受"时进入 Yjs，不污染协作撤销栈）。
 *  2. 对话（chat）：右侧面板的自由问答，自动携带当前文档纯文本作为上下文。
 *
 * @param {import('@tiptap/react').Editor | null} editor TipTap 编辑器实例
 */
export function useAIAssistant(editor) {
  /* ── 内联动作状态 ── */
  const [inlineState, setInlineState] = useState({
    visible: false, // 结果浮层是否显示
    loading: false, // 是否正在流式输出
    result: '', // 累积的输出文本
    action: null, // 当前执行的动作 key
    from: null, // 选区起点
    to: null, // 选区终点
    original: '', // 原始选中文本
  });

  /* ── 对话状态 ── */
  const [chatMessages, setChatMessages] = useState([]); // [{ role, content }]
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const inlineAbortRef = useRef(null);
  const chatAbortRef = useRef(null);

  /* 卸载时中止所有进行中的请求 */
  useEffect(() => {
    return () => {
      inlineAbortRef.current?.abort();
      chatAbortRef.current?.abort();
    };
  }, []);

  /* ── 对选中文本执行 AI 动作 ── */
  const runAction = useCallback(
    (action) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      const original = editor.state.doc.textBetween(from, to, ' ').trim();
      if (!original) return;

      inlineAbortRef.current?.abort();
      setInlineState({ visible: true, loading: true, result: '', action, from, to, original });

      inlineAbortRef.current = aiActionStream(action, original, {
        onToken: (token) =>
          setInlineState((s) => (s.action === action ? { ...s, result: s.result + token } : s)),
        onDone: () => setInlineState((s) => ({ ...s, loading: false })),
        onError: (err) =>
          setInlineState((s) => ({
            ...s,
            loading: false,
            result: s.result || `AI 请求失败：${err.message || '请稍后重试'}`,
          })),
      });
    },
    [editor]
  );

  /* ── 接受结果：替换原选区 ── */
  const acceptResult = useCallback(() => {
    if (!editor || !inlineState.result) return;
    const { from, to, result } = inlineState;
    editor
      .chain()
      .focus()
      .insertContentAt({ from, to }, result)
      .run();
    setInlineState((s) => ({ ...s, visible: false }));
  }, [editor, inlineState]);

  /* ── 插入到选区之后（不替换原文） ── */
  const insertAfter = useCallback(() => {
    if (!editor || !inlineState.result) return;
    const { to, result } = inlineState;
    editor
      .chain()
      .focus()
      .insertContentAt(to, `\n${result}`)
      .run();
    setInlineState((s) => ({ ...s, visible: false }));
  }, [editor, inlineState]);

  /* ── 重新生成 ── */
  const retryAction = useCallback(() => {
    if (inlineState.action) runAction(inlineState.action);
  }, [inlineState.action, runAction]);

  /* ── 关闭/丢弃 ── */
  const dismissResult = useCallback(() => {
    inlineAbortRef.current?.abort();
    setInlineState((s) => ({ ...s, visible: false, loading: false }));
  }, []);

  /* ── 发送对话消息 ── */
  const sendChatMessage = useCallback(
    (content) => {
      const text = String(content || '').trim();
      if (!text || chatLoading) return;

      const nextMessages = [...chatMessages, { role: 'user', content: text }];
      setChatMessages(nextMessages);
      setChatInput('');
      setChatLoading(true);

      const docContext = editor?.getText?.() || '';
      let assistantText = '';

      chatAbortRef.current?.abort();
      chatAbortRef.current = aiChatStream(nextMessages, docContext, {
        onToken: (token) => {
          assistantText += token;
          setChatMessages([...nextMessages, { role: 'assistant', content: assistantText }]);
        },
        onDone: () => setChatLoading(false),
        onError: (err) => {
          setChatLoading(false);
          setChatMessages([
            ...nextMessages,
            { role: 'assistant', content: `AI 请求失败：${err.message || '请稍后重试'}` },
          ]);
        },
      });
    },
    [chatMessages, chatLoading, editor]
  );

  const clearChat = useCallback(() => {
    chatAbortRef.current?.abort();
    setChatMessages([]);
    setChatLoading(false);
  }, []);

  return {
    // 内联动作
    inlineState,
    runAction,
    acceptResult,
    insertAfter,
    retryAction,
    dismissResult,
    // 对话
    chatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    sendChatMessage,
    clearChat,
  };
}

export default useAIAssistant;
