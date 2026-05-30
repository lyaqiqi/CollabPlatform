const express = require('express');
const { registerController, loginController, refreshController } = require('../controllers/auth.controller');

const router = express.Router();

// POST /api/auth/register — 注册
router.post('/register', registerController);

// POST /api/auth/login — 登录
router.post('/login', loginController);

// POST /api/auth/refresh — 刷新 accessToken
router.post('/refresh', refreshController);

module.exports = router;
