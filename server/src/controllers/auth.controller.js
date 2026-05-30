const authService = require('../services/auth.service');
const { success } = require('../utils/response');

async function registerController(req, res, next) {
  try {
    const user = await authService.register(req.body);
    return success(res, user, '注册成功', 201);
  } catch (err) {
    next(err);
  }
}

async function loginController(req, res, next) {
  try {
    const result = await authService.login(req.body);
    return success(res, result, '登录成功');
  } catch (err) {
    next(err);
  }
}

async function refreshController(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    return success(res, result, 'token 刷新成功');
  } catch (err) {
    next(err);
  }
}

module.exports = { registerController, loginController, refreshController };
