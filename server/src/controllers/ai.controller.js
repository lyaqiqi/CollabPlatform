const aiService = require('../services/ai.service');
const AppError = require('../utils/AppError');

/**
 * AI 助手控制器。
 *
 * 与普通 JSON 接口不同，这里返回的是 SSE（text/event-stream）流：
 *   data: {"token":"片段"}\n\n   —— 每个增量
 *   data: {"error":"..."}\n\n    —— 出错（响应头已发送时）
 *   data: [DONE]\n\n             —— 结束标志
 */

/** 写入 SSE 响应头并立即冲刷（关闭代理缓冲，保证逐字下发）。 */
function setupSse(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲
  res.flushHeaders?.();
}

function writeToken(res, token) {
  res.write(`data: ${JSON.stringify({ token })}\n\n`);
}

/** 流式过程中出错：若已开始下发则以 SSE 形式告知前端，否则交给统一错误中间件。 */
function handleStreamError(res, err, next) {
  if (res.headersSent) {
    try {
      res.write(`data: ${JSON.stringify({ error: err.message || 'AI 请求失败' })}\n\n`);
      res.write('data: [DONE]\n\n');
    } catch {
      /* 连接可能已关闭，忽略 */
    }
    res.end();
  } else {
    next(err);
  }
}

/**
 * POST /api/ai/action
 * body: { action: string, text: string }
 */
async function actionController(req, res, next) {
  const { action, text } = req.body || {};

  if (!action || !text || !String(text).trim()) {
    return next(new AppError(400, AppError.CODES.BAD_REQUEST, 'action 和 text 不能为空'));
  }
  if (!aiService.isValidAction(action)) {
    return next(new AppError(400, AppError.CODES.BAD_REQUEST, `不支持的 AI 动作：${action}`));
  }

  // 客户端断开时中止上游请求，避免无谓的 token 消耗。
  // 注意：必须监听 res 的 close 且判断响应是否已结束——
  // req 的 close 在 express.json() 读完请求体后会立即触发，会误杀上游请求。
  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    setupSse(res);
    await aiService.streamAction(action, String(text), {
      onToken: (token) => writeToken(res, token),
      signal: abortController.signal,
    });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    handleStreamError(res, err, next);
  }
}

/**
 * POST /api/ai/chat
 * body: { messages: [{ role, content }], docContext?: string }
 */
async function chatController(req, res, next) {
  const { messages, docContext = '' } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return next(new AppError(400, AppError.CODES.BAD_REQUEST, 'messages 不能为空'));
  }

  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    setupSse(res);
    await aiService.streamChat(messages, docContext, {
      onToken: (token) => writeToken(res, token),
      signal: abortController.signal,
    });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    handleStreamError(res, err, next);
  }
}

module.exports = { actionController, chatController };
