import { TOKEN_KEY } from '../store/authStore';

/**
 * AI 助手 API。
 *
 * 与其它接口不同，AI 接口返回 SSE 流，axios 无法增量读取，
 * 因此这里用原生 fetch + ReadableStream 解析后端逐字下发的 token。
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * 发起一次 SSE 流式请求。
 * @param {string} endpoint  例如 '/ai/action'
 * @param {object} body      请求体
 * @param {object} handlers
 * @param {(token: string) => void} handlers.onToken  收到一个增量片段
 * @param {() => void}              [handlers.onDone]  流正常结束
 * @param {(err: Error) => void}    [handlers.onError] 出错
 * @returns {AbortController}  调用 .abort() 可中止该流
 */
export function streamRequest(endpoint, body, { onToken, onDone, onError }) {
  const controller = new AbortController();
  const token = localStorage.getItem(TOKEN_KEY);

  fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        // 错误时后端可能返回 JSON（鉴权失败等）
        let message = `请求失败（${res.status}）`;
        try {
          const data = await res.json();
          message = data?.message || message;
        } catch {
          /* 非 JSON，保留默认提示 */
        }
        throw new Error(message);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // 保留不完整的最后一行

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            onDone?.();
            return;
          }
          try {
            const json = JSON.parse(data);
            if (json.error) throw new Error(json.error);
            if (json.token) onToken?.(json.token);
          } catch (err) {
            if (err instanceof Error && err.message && !/Unexpected|JSON/.test(err.message)) {
              throw err; // 后端下发的业务错误
            }
            /* 解析失败的行直接忽略 */
          }
        }
      }
      onDone?.();
    })
    .catch((err) => {
      if (err?.name === 'AbortError') return; // 主动取消，不算错误
      onError?.(err);
    });

  return controller;
}

/**
 * 对选中文本执行预设 AI 动作（改写 / 翻译 / 总结 …）。
 * @param {string} action
 * @param {string} text
 * @param {object} handlers  { onToken, onDone, onError }
 */
export function aiActionStream(action, text, handlers) {
  return streamRequest('/ai/action', { action, text }, handlers);
}

/**
 * 文档 AI 对话（携带文档上下文）。
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} docContext
 * @param {object} handlers  { onToken, onDone, onError }
 */
export function aiChatStream(messages, docContext, handlers) {
  return streamRequest('/ai/chat', { messages, docContext }, handlers);
}
