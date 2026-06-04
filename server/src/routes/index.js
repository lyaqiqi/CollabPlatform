const express = require('express');
const authRoutes = require('./auth.routes');
const healthRoutes = require('./health.routes');
const boardRoutes = require('./boards.routes');
const itemRoutes = require('./items.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/', healthRoutes);
router.use('/boards', boardRoutes);
router.use('/items', itemRoutes);
// TODO: 由 C 实现文档业务路由 router.use('/docs', ...)
// TODO: 由 E 实现版本/评论路由 router.use('/versions', ...) / router.use('/comments', ...)

module.exports = router;
