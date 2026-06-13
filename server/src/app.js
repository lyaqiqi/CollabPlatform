const express = require('express');
const cors = require('cors');
const { CLIENT_ORIGIN } = require('./config/env');
const requestLogger = require('./middlewares/requestLogger');
const errorHandler = require('./middlewares/errorHandler');
const routes = require('./routes/index');

const app = express();

// CORS
app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true,
}));

// JSON 解析（Yjs 二进制快照经 Base64 编码后体积较大，调高上限）
app.use(express.json({ limit: '10mb' }));

// 请求日志
app.use(requestLogger);

// 所有 API 路由挂载在 /api 前缀
app.use('/api', routes);

// 统一错误处理（必须在路由之后）
app.use(errorHandler);

module.exports = app;
