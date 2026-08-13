import { create } from 'zustand';
import type { User } from '../types/auth';
import { STORAGE_KEYS, getJSON, removeKey, setJSON } from '../lib/storage';
import { clearAuth, getToken, setToken, setUser as persistUser } from '../lib/apiClient';
import { register as registerApi, login as loginApi } from '../services/authApi';

interface AuthState {
  token: string | null;
  user: User | null;
  inviteVerified: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  setInviteVerified: (v: boolean) => void;
}

function hydrate(): { token: string | null; user: User | null; inviteVerified: boolean } {
  return {
    token: getToken(),
    user: getJSON<User>(STORAGE_KEYS.user),
    inviteVerified: localStorage.getItem(STORAGE_KEYS.aiInviteVerified) === 'true',
  };
}

const initial = hydrate();

export const useAuthStore = create<AuthState>((set) => ({
  token: initial.token,
  user: initial.user,
  inviteVerified: initial.inviteVerified,

  login: async (email, password) => {
    const data = await loginApi(email, password);
    setToken(data.access_token);
    const user = { email };
    persistUser(user);
    set({ token: data.access_token, user });
  },

  register: async (username, email, password) => {
    await registerApi(username, email, password);
    // 注册后自动登录
    const data = await loginApi(email, password);
    setToken(data.access_token);
    const user = { email, username };
    persistUser(user);
    set({ token: data.access_token, user });
  },

  logout: () => {
    clearAuth();
    setJSON(STORAGE_KEYS.aiInviteVerified, 'false');
    set({ token: null, user: null, inviteVerified: false });
  },

  setInviteVerified: (v) => {
    setJSON(STORAGE_KEYS.aiInviteVerified, v);
    set({ inviteVerified: v });
  },
}));

// 401 时全局登出（供 apiClient/useSSE 调用）
export function forceLogout(): void {
  removeKey(STORAGE_KEYS.token);
  removeKey(STORAGE_KEYS.user);
  removeKey(STORAGE_KEYS.aiInviteVerified);
  useAuthStore.setState({ token: null, user: null, inviteVerified: false });
}
