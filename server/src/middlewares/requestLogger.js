const morgan = require('morgan');

// 格式：方法 路径 状态码 耗时
const requestLogger = morgan(':method :url :status :response-time ms');

module.exports = requestLogger;
