import request from './request';

/** 注册 */
export function register(data) {
  return request.post('/auth/register', data);
}

/** 登录，返回 { accessToken, refreshToken, user } */
export function login(data) {
  return request.post('/auth/login', data);
}

/** 用 refreshToken 换新的 accessToken */
export function refresh(refreshToken) {
  return request.post('/auth/refresh', { refreshToken });
}

/** 获取当前登录用户信息 */
export function getMe() {
  return request.get('/me');
}
