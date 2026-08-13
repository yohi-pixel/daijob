import { apiFetch } from '../lib/apiClient';
import type { TokenResponse } from '../types/auth';

export async function register(username: string, email: string, password: string): Promise<{ message: string; user_id: number }> {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: { username, email, password },
  });
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}
