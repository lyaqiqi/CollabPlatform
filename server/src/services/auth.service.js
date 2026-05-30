const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');
const { signAccessToken, signRefreshToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

const SALT_ROUNDS = 10;

/**
 * 注册新用户
 * @param {{ username: string, email: string, password: string }} data
 */
async function register({ username, email, password }) {
  // 参数校验
  if (!username || !email || !password) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '用户名、邮箱、密码不能为空');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '邮箱格式不合法');
  }
  if (password.length < 8) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '密码长度不能少于 8 位');
  }

  // 检查 email / username 是否已存在
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    const field = existing.email === email ? '邮箱' : '用户名';
    throw new AppError(409, AppError.CODES.CONFLICT, `${field}已被注册`);
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      user_id: uuidv4(),
      username,
      email,
      password_hash,
    },
    select: { user_id: true, username: true, email: true, created_at: true },
  });

  // TODO: 由 D 实现邮箱激活流程
  return user;
}

/**
 * 用户登录
 * @param {{ email: string, password: string }} data
 */
async function login({ email, password }) {
  if (!email || !password) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, '邮箱和密码不能为空');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, AppError.CODES.UNAUTHORIZED, '邮箱或密码错误');
  }

  // TODO: 由 D 实现登录失败次数限制/锁定
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError(401, AppError.CODES.UNAUTHORIZED, '邮箱或密码错误');
  }

  if (user.status === 'banned') {
    throw new AppError(403, AppError.CODES.FORBIDDEN, '账号已被封禁');
  }

  const payload = { userId: user.user_id };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    user: {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
    },
  };
}

/**
 * 用 refresh token 换新的 access token
 * @param {string} refreshToken
 */
async function refresh(refreshToken) {
  if (!refreshToken) {
    throw new AppError(400, AppError.CODES.BAD_REQUEST, 'refreshToken 不能为空');
  }
  const { verifyToken, signAccessToken } = require('../utils/jwt');
  const payload = verifyToken(refreshToken); // 校验失败会抛 AppError
  const newAccessToken = signAccessToken({ userId: payload.userId });
  return { accessToken: newAccessToken };
}

module.exports = { register, login, refresh };
