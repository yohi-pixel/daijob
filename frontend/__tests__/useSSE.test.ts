import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSSE } from '../src/hooks/useSSE';
import { useAuthStore } from '../src/stores/authStore';

function mockFetchStream(chunks: string[], status = 200, body?: unknown) {
  const encoder = new TextEncoder();
  return vi.fn().mockImplementation(async () => {
    if (status !== 200) {
      return {
        ok: false,
        status,
        json: async () => body ?? {},
      };
    }
    const stream = new ReadableStream({
      start(controller) {
        chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
        controller.close();
      },
    });
    return { ok: true, status: 200, body: stream };
  });
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ token: null, user: null, inviteVerified: false });
  vi.restoreAllMocks();
});

describe('useSSE', () => {
  it('正常流：content 累积 + done', async () => {
    globalThis.fetch = mockFetchStream(['data: {"content": "你', '好"}\n\ndata: [DONE]\n\n']);
    const { result } = renderHook(() => useSSE({ url: '/api/ai/chat' }));
    await act(async () => {
      await result.current.start({ message: 'hi' });
    });
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.content).toBe('你好');
  });

  it('profile_ready 回调触发', async () => {
    globalThis.fetch = mockFetchStream(['data: {"profile_ready": true}\n\ndata: [DONE]\n\n']);
    const onProfileReady = vi.fn();
    const { result } = renderHook(() => useSSE({ url: '/api/ai/chat', onProfileReady }));
    await act(async () => {
      await result.current.start({ message: 'hi' });
    });
    expect(onProfileReady).toHaveBeenCalled();
  });

  it('HTTP 403 → invite 失效 + error', async () => {
    globalThis.fetch = mockFetchStream([], 403, { detail: '需要邀请码' });
    const { result } = renderHook(() => useSSE({ url: '/api/ai/chat' }));
    await act(async () => {
      await result.current.start({});
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toContain('邀请码');
    expect(useAuthStore.getState().inviteVerified).toBe(false);
  });

  it('HTTP 500 → error', async () => {
    globalThis.fetch = mockFetchStream([], 500, { detail: 'AI service unavailable' });
    const { result } = renderHook(() => useSSE({ url: '/api/ai/chat' }));
    await act(async () => {
      await result.current.start({});
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toContain('AI service unavailable');
  });

  it('abort 后 status 回到 idle 且不报错', async () => {
    const encoder = new TextEncoder();
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"content": "a"}\n\n'));
          // 监听 abort：流错误化，read() reject
          init?.signal?.addEventListener('abort', () => {
            controller.error(new DOMException('Aborted', 'AbortError'));
          });
        },
      });
      return { ok: true, status: 200, body: stream } as Response;
    });
    const { result } = renderHook(() => useSSE({ url: '/api/ai/chat' }));
    const startPromise = act(async () => {
      result.current.start({});
    });
    await new Promise((r) => setTimeout(r, 50));
    act(() => result.current.abort());
    await startPromise;
    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.error).toBeNull();
  });
});
