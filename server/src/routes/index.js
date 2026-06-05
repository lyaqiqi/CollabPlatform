const express = require('express');
const authRoutes = require('./auth.routes');
const healthRoutes = require('./health.routes');
const boardRoutes = require('./boards.routes');
const docRoutes = require('./doc.routes');
const itemRoutes = require('./items.routes');

const router = express.Router();

// 认证相关路由
router.use('/auth', authRoutes);

// 健康检查 + 用户信息路由
router.use('/', healthRoutes);

// 文档模块（C）
router.use('/docs', docRoutes);

// 白板模块（B）
// 白板模块（B）
router.use('/boards', boardRoutes);

// 用户/项目管理路由（D）
router.use('/items', itemRoutes);

// TODO: 由 E 实现版本/评论路由 router.use('/versions', ...) / router.use('/comments', ...)
// 说明，评论路由是在文档路由下面的，不需要单独添加

module.exports = router;
