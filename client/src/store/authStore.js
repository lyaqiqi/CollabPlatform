import { create } from 'zustand';

const TOKEN_KEY = 'collab_access_token';
const REFRESH_TOKEN_KEY = 'collab_refresh_token';
const USER_KEY = 'collab_user';

/** 启动时同步读取，避免首屏 ProtectedRoute 抢在 useEffect 之前判未登录 */
function readAuthFromStorage() {
  const accessToken = localStorage.getItem(TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const userStr = localStorage.getItem(USER_KEY);
  if (!accessToken || !userStr) {
    return { user: null, accessToken: null, refreshToken: null };
  }
  try {
    const user = JSON.parse(userStr);
    return { user, accessToken, refreshToken };
  } catch {
    localStorage.removeItem(USER_KEY);
    return { user: null, accessToken: null, refreshToken: null };
  }
}

const useAuthStore = create((set) => ({
  ...readAuthFromStorage(),

  /** 登录成功后保存认证信息，token 同步写入 localStorage */
  setAuth: ({ user, accessToken, refreshToken }) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, accessToken, refreshToken });
  },

  /** 退出登录，清空 state 和 localStorage */
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ user: null, accessToken: null, refreshToken: null });
  },

  /** 应用启动时从 localStorage 恢复登录态（与初始同步读取保持一致） */
  loadFromStorage: () => {
    set(readAuthFromStorage());
  },
}));

export default useAuthStore;
