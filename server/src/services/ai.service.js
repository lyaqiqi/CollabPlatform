const { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * 文档 AI 助手服务层。
 *
 * 通过 DeepSeek 的 OpenAI 兼容接口（/chat/completions）以流式（SSE）方式
 * 生成内容。这里使用 Node 18+ 内置的全局 fetch，无需额外依赖。
 *
 * 设计要点：
 *  - service 只负责"调模型 + 解析流"，不直接操作 Express 响应；
 *    通过 onToken 回调把 token 交还给 controller，由 controller 决定如何下发。
 *  - 通过 AbortSignal 支持客户端断开时及时中止上游请求。
 */

const SYSTEM_PROMPT =
  '你是一个专业的中文文档写作助手，嵌入在一个协作文档编辑器中。' +
  '请直接输出结果，不要解释你正在做什么，也不要添加额外的客套话或 Markdown 代码围栏。';

/** 选中文本动作 → 指令前缀。新增动作只需在此登记。 */
const ACTION_PROMPTS = {
  improve: '请优化下面这段文字，使其更流畅、专业，保持原意与语言，直接返回优化后的文字：\n\n',
  fix_grammar: '请修正下面这段文字中的语法、错别字与标点错误，直接返回修正后的文字：\n\n',
  summarize: '请用简洁的语言总结下面内容的核心要点，使用条理清晰的表达：\n\n',
  explain: '请通俗易懂地解释下面的内容：\n\n',
  expand: '请在不改变原意的前提下扩展下面的内容，补充细节与示例：\n\n',
  shorten: '请精简下面的文字，保留核心信息，压缩到原长度的一半左右：\n\n',
  continue: '请承接下面的文字继续写作，保持风格一致，续写约 100-200 字：\n\n',
  translate_en: '请把下面的文字翻译成自然流畅的英文，直接返回译文：\n\n',
  translate_zh: '请把下面的文字翻译成自然流畅的中文，直接返回译文：\n\n',
};

/** 校验动作是否受支持（controller 在写响应头前调用）。 */
function isValidAction(action) {
  return Object.prototype.hasOwnProperty.call(ACTION_PROMPTS, action);
}

/**
 * 调用 DeepSeek 流式补全，并将增量 token 通过 onToken 回调输出。
 * @param {Array<{role: string, content: string}>} messages
 * @param {{ onToken: (token: string) => void, signal?: AbortSignal }} options
 */
async function streamChatCompletion(messages, { onToken, signal }) {
  if (!DEEPSEEK_API_KEY) {
    throw new AppError(500, AppError.CODES.INTERNAL, 'AI 服务未配置：缺少 DEEPSEEK_API_KEY');
  }

  let response;
  try {
    response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        stream: true,
        messages,
        temperature: 0.7,
      }),
    });
  } catch (err) {
    if (err?.name === 'AbortError') return; // 客户端断开，静默结束
    throw new AppError(502, AppError.CODES.INTERNAL, `无法连接 DeepSeek 服务：${err.message}`);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const httpStatus = response.status === 401 ? 401 : 502;
    throw new AppError(
      httpStatus,
      AppError.CODES.INTERNAL,
      `DeepSeek 返回错误 ${response.status}：${errText.slice(0, 200)}`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // 保留可能不完整的最后一行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          const token = json.choices?.[0]?.delta?.content || '';
          if (token) onToken(token);
        } catch {
          /* 跳过无法解析的行（心跳/空行等） */
        }
      }
    }
  } catch (err) {
    if (err?.name !== 'AbortError') throw err; // 中止属正常情况
  }
}

/**
 * 对选中文本执行预设动作（改写、翻译、总结等），流式输出。
 * @param {string} action  ACTION_PROMPTS 中的 key
 * @param {string} text    选中的正文文本
 */
async function streamAction(action, text, options) {
  const prefix = ACTION_PROMPTS[action];
  if (!prefix) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, `不支持的 AI 动作：${action}`);
  }
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prefix + text },
  ];
  return streamChatCompletion(messages, options);
}

/**
 * 文档问答 / 自由对话，携带当前文档纯文本作为上下文，流式输出。
 * @param {Array<{role: string, content: string}>} messages 对话历史
 * @param {string} docContext 当前文档纯文本（会被截断）
 */
async function streamChat(messages, docContext, options) {
  const context = String(docContext || '').slice(0, 4000);
  const systemMessage = {
    role: 'system',
    content:
      `${SYSTEM_PROMPT}\n\n以下是用户当前正在编辑的文档内容，请结合它来回答用户的问题；` +
      `若问题与文档无关，则正常回答即可。\n\n【当前文档内容开始】\n${context}\n【当前文档内容结束】`,
  };
  // 仅保留合法的对话消息，避免注入异常字段
  const safeMessages = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content }));

  return streamChatCompletion([systemMessage, ...safeMessages], options);
}

module.exports = {
  ACTION_PROMPTS,
  isValidAction,
  streamAction,
  streamChat,
};
