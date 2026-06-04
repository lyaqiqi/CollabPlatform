const { verifyToken } = require('../utils/jwt');
const { fail } = require('../utils/response');
const AppError = require('../utils/AppError');

/**
 * JWT 鉴权中间件。
 * 从 Authorization: Bearer <token> 头取 token，校验后将用户信息挂到 req.user。
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, 401, AppError.CODES.UNAUTHORIZED, '未提供 token，请先登录');
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token, 'access');
    req.user = { userId: payload.userId };
    next();
  } catch (err) {
    return fail(res, 401, AppError.CODES.UNAUTHORIZED, err.message);
  }
}

module.exports = authMiddleware;
