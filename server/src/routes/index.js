const express = require('express');
const authRoutes = require('./auth.routes');
const healthRoutes = require('./health.routes');
const boardRoutes = require('./boards.routes');
const docRoutes = require('./doc.routes');

const router = express.Router();

// 认证相关路由
router.use('/auth', authRoutes);

// 健康检查 + 用户信息路由
router.use('/', healthRoutes);

// 文档模块（C）
router.use('/docs', docRoutes);

router.use('/boards', boardRoutes);
// TODO: 由 D 实现用户/项目管理路由 router.use('/items', ...)
// TODO: 由 E 实现版本/评论路由 router.use('/versions', ...) / router.use('/comments', ...)

module.exports = router;
