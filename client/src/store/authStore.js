import { create } from 'zustand';

export const TOKEN_KEY = 'collab_access_token';
export const REFRESH_TOKEN_KEY = 'collab_refresh_token';
export const USER_KEY = 'collab_user';
export const DEBUG_PREVIEW_KEY = 'collab_debug_preview';

export function isDebugPreviewEnabled() {
  return localStorage.getItem(DEBUG_PREVIEW_KEY) === 'true';
}

function clearStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(DEBUG_PREVIEW_KEY);
}

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,

  setAuth: ({ user, accessToken, refreshToken }) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, accessToken, refreshToken });
  },

  setAccessToken: (accessToken) => {
    if (accessToken) {
      localStorage.setItem(TOKEN_KEY, accessToken);
    }
    set({ accessToken });
  },

  setUser: (user) => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
    set({ user });
  },

  clearAuth: () => {
    clearStorage();
    set({ user: null, accessToken: null, refreshToken: null });
  },

  logout: () => {
    get().clearAuth();
  },

  loadFromStorage: () => {
    const accessToken = localStorage.getItem(TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);

    if (!accessToken || !refreshToken || !userStr) {
      clearStorage();
      set({ user: null, accessToken: null, refreshToken: null });
      return;
    }

    try {
      const user = JSON.parse(userStr);
      set({ user, accessToken, refreshToken });
    } catch {
      clearStorage();
      set({ user: null, accessToken: null, refreshToken: null });
    }
  },
}));

export default useAuthStore;
