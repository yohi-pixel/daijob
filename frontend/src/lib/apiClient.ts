import { ApiError } from '../types/api';
import { STORAGE_KEYS, getJSON, removeKey } from './storage';

export const API_BASE_URL = '/api';

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.token);
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.token, token);
}

export function clearAuth(): void {
  removeKey(STORAGE_KEYS.token);
  removeKey(STORAGE_KEYS.user);
}

export function setUser(user: { email: string; username?: string }): void {
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

export function getUser(): { email: string; username?: string } | null {
  return getJSON<{ email: string; username?: string }>(STORAGE_KEYS.user);
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiFetch<T = unknown>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (e) {
    throw new ApiError(e instanceof Error ? e.message : String(e), 0);
  }

  if (!response.ok) {
    let detail = `请求失败 (${response.status})`;
    try {
      const errBody = await response.json();
      if (typeof errBody.detail === 'string') detail = errBody.detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}
