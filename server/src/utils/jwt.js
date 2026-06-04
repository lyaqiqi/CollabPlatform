const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN } = require('../config/env');
const AppError = require('./AppError');

/**
 * 签发 access token
 * @param {{ userId: string }} payload
 */
function signAccessToken(payload) {
  return jwt.sign({ ...payload, token_type: 'access' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 签发 refresh token（有效期更长）
 * @param {{ userId: string }} payload
 */
function signRefreshToken(payload) {
  return jwt.sign({ ...payload, token_type: 'refresh' }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

/**
 * 校验 token，成功返回 payload，失败抛出 AppError
 * @param {string} token
 * @param {'access' | 'refresh'} [expectedType]
 */
function verifyToken(token, expectedType) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (expectedType && payload.token_type !== expectedType) {
      throw new AppError(401, AppError.CODES.UNAUTHORIZED, 'token 类型不匹配');
    }
    return payload;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError(401, AppError.CODES.UNAUTHORIZED, 'token 无效或已过期');
  }
}

module.exports = { signAccessToken, signRefreshToken, verifyToken };
