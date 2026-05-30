import axios from 'axios';
import { ERROR_CODES } from '../utils/constants';

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
});

// 请求拦截器：自动附加 accessToken
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('collab_access_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一处理业务错误码
instance.interceptors.response.use(
  (res) => {
    const { code, data, message } = res.data;

    if (code === ERROR_CODES.SUCCESS) {
      return data; // 直接返回业务数据，业务层无需解包
    }

    if (code === ERROR_CODES.UNAUTHORIZED) {
      // token 失效，清理登录态并跳登录页
      // 这里直接操作 localStorage 避免循环依赖（store 依赖此文件）
      localStorage.removeItem('collab_access_token');
      localStorage.removeItem('collab_refresh_token');
      localStorage.removeItem('collab_user');
      window.location.href = '/login';
      return Promise.reject(new Error(message));
    }

    // 其他业务错误：弹 Toast 并 reject
    import('../components/Toast').then(({ default: Toast }) => {
      Toast.error(message || '请求失败');
    });
    return Promise.reject(new Error(message));
  },
  (err) => {
    // 网络层错误
    import('../components/Toast').then(({ default: Toast }) => {
      Toast.error(err.message === 'Network Error' ? '网络异常，请检查连接' : err.message);
    });
    return Promise.reject(err);
  }
);

export default instance;
