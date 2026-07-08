const express = require('express');
const authMiddleware = require('../middlewares/auth');
const { actionController, chatController } = require('../controllers/ai.controller');

const router = express.Router();

// 所有 AI 接口都需要登录
router.use(authMiddleware);

// 对选中文本执行预设动作（改写 / 翻译 / 总结 …），SSE 流式返回
router.post('/action', actionController);

// 文档 AI 对话（携带文档上下文），SSE 流式返回
router.post('/chat', chatController);

module.exports = router;
