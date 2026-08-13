import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, forceLogout } from '../src/stores/authStore';
import { STORAGE_KEYS } from '../src/lib/storage';

// mock services 层，避免真实网络调用
vi.mock('../src/services/authApi', () => ({
  login: vi.fn(async () => ({
    access_token: 'token-abc',
    token_type: 'bearer',
    expires_in: 3600,
  })),
  register: vi.fn(async () => ({ message: 'ok', user_id: 1 })),
}));

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ token: null, user: null, inviteVerified: false });
});

describe('authStore', () => {
  it('login 写 token 与 user', async () => {
    const s = useAuthStore.getState();
    await s.login('a@b.com', 'pw');
    const st = useAuthStore.getState();
    expect(st.token).toBe('token-abc');
    expect(st.user).toEqual({ email: 'a@b.com' });
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBe('token-abc');
  });

  it('register 后自动登录', async () => {
    const s = useAuthStore.getState();
    await s.register('u', 'a@b.com', 'pw');
    const st = useAuthStore.getState();
    expect(st.token).toBe('token-abc');
    expect(st.user?.email).toBe('a@b.com');
  });

  it('logout 清空 token/user/invite', () => {
    useAuthStore.setState({ token: 't', user: { email: 'a@b.com' }, inviteVerified: true });
    localStorage.setItem(STORAGE_KEYS.token, 't');
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ email: 'a@b.com' }));
    useAuthStore.getState().logout();
    const st = useAuthStore.getState();
    expect(st.token).toBeNull();
    expect(st.user).toBeNull();
    expect(st.inviteVerified).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBeNull();
  });

  it('setInviteVerified 持久化', () => {
    useAuthStore.getState().setInviteVerified(true);
    expect(useAuthStore.getState().inviteVerified).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.aiInviteVerified)).toBe('true');
  });

  it('forceLogout 重置状态', () => {
    localStorage.setItem(STORAGE_KEYS.token, 't');
    useAuthStore.setState({ token: 't', user: { email: 'a' }, inviteVerified: true });
    forceLogout();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().inviteVerified).toBe(false);
  });
});
