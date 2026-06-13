import request from './request';

export function register(data) {
  return request.post('/auth/register', data);
}

export function login(data) {
  return request.post('/auth/login', data);
}

export function refresh(refreshToken) {
  return request.post('/auth/refresh', { refreshToken });
}

export function getMe() {
  return request.get('/me');
}
