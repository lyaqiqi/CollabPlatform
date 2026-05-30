const express = require('express');
const prisma = require('../config/prisma');
const authMiddleware = require('../middlewares/auth');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');

const router = express.Router();

// GET /api/health — 健康检查，无需鉴权
router.get('/health', (req, res) => {
  return success(res, { status: 'ok', time: new Date().toISOString() });
});

// GET /api/me — 受保护，返回当前登录用户信息
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { user_id: req.user.userId },
      select: { user_id: true, username: true, email: true, status: true },
    });
    if (!user) {
      throw new AppError(404, AppError.CODES.NOT_FOUND, '用户不存在');
    }
    return success(res, user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
