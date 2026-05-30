import { create } from 'zustand';

const TOKEN_KEY = 'collab_access_token';
const REFRESH_TOKEN_KEY = 'collab_refresh_token';
const USER_KEY = 'collab_user';

const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,

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

  /** 应用启动时从 localStorage 恢复登录态 */
  loadFromStorage: () => {
    const accessToken = localStorage.getItem(TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    if (accessToken && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, accessToken, refreshToken });
      } catch {
        // localStorage 数据损坏时静默清理
        localStorage.removeItem(USER_KEY);
      }
    }
  },
}));

export default useAuthStore;
