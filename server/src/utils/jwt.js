const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN } = require('../config/env');
const AppError = require('./AppError');

/**
 * 签发 access token
 * @param {{ userId: string }} payload
 */
function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 签发 refresh token（有效期更长）
 * @param {{ userId: string }} payload
 */
function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

/**
 * 校验 token，成功返回 payload，失败抛出 AppError
 * @param {string} token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new AppError(401, AppError.CODES.UNAUTHORIZED, 'token 无效或已过期');
  }
}

module.exports = { signAccessToken, signRefreshToken, verifyToken };
