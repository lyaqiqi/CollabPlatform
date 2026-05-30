const AppError = require('../utils/AppError');
const { fail } = require('../utils/response');

/**
 * 统一错误处理中间件，必须放在所有路由之后挂载（4 个参数）。
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return fail(res, err.httpStatus, err.code, err.message);
  }

  // 未知错误
  if (process.env.NODE_ENV === 'development') {
    console.error('[errorHandler]', err);
  }
  return fail(res, 500, AppError.CODES.INTERNAL, '服务器内部错误');
}

module.exports = errorHandler;
