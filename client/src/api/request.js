import axios from 'axios';
import { ERROR_CODES } from '../utils/constants';
import useAuthStore, { TOKEN_KEY, REFRESH_TOKEN_KEY } from '../store/authStore';

const baseURL = import.meta.env.VITE_API_BASE_URL;
const AUTH_SKIP_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

const instance = axios.create({
  baseURL,
  timeout: 10000,
});

let refreshPromise = null;

function isRefreshEligible(config) {
  const url = config?.url || '';
  return !AUTH_SKIP_REFRESH_PATHS.some((path) => url.includes(path));
}

function redirectToLogin() {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

function clearAuth() {
  useAuthStore.getState().clearAuth();
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    throw new Error('refreshToken 不存在');
  }

  const response = await axios.post(
    `${baseURL}/auth/refresh`,
    { refreshToken },
    { timeout: 10000 }
  );

  const nextAccessToken = response.data?.data?.accessToken;
  if (!nextAccessToken) {
    throw new Error(response.data?.message || 'token 刷新失败');
  }

  useAuthStore.getState().setAccessToken(nextAccessToken);
  localStorage.setItem(TOKEN_KEY, nextAccessToken);
  return nextAccessToken;
}

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

instance.interceptors.response.use(
  (res) => {
    const { code, data, message } = res.data || {};

    if (code === ERROR_CODES.SUCCESS) {
      return data;
    }

    return Promise.reject(new Error(message || '请求失败'));
  },
  async (err) => {
    const originalRequest = err.config || {};
    const responseData = err.response?.data;
    const code = responseData?.code;
    const message = responseData?.message || err.message || '请求失败';

    if (
      code === ERROR_CODES.UNAUTHORIZED &&
      !originalRequest._retry &&
      isRefreshEligible(originalRequest) &&
      localStorage.getItem(REFRESH_TOKEN_KEY)
    ) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const nextAccessToken = await refreshPromise;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
        return instance(originalRequest);
      } catch (refreshError) {
        clearAuth();
        import('../components/Toast').then(({ default: Toast }) => {
          Toast.info('登录已过期，请重新登录');
        });
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    if (code === ERROR_CODES.UNAUTHORIZED) {
      clearAuth();
      redirectToLogin();
      return Promise.reject(new Error(message));
    }

    if (code) {
      import('../components/Toast').then(({ default: Toast }) => {
        Toast.error(message || '请求失败');
      });
      return Promise.reject(new Error(message));
    }

    import('../components/Toast').then(({ default: Toast }) => {
      Toast.error(err.message === 'Network Error' ? '网络异常，请检查连接' : message);
    });
    return Promise.reject(err);
  }
);

export default instance;
