import { useCallback, useEffect, useRef, useState } from 'react';
import type { SSEEvent } from '../types/ai';
import { parseSSELine } from '../lib/sse';
import { getToken } from '../lib/apiClient';
import { useAuthStore, forceLogout } from '../stores/authStore';
import { ApiError } from '../types/api';

export type SSEStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

interface UseSSEOptions {
  url: string;
  onEvent?: (ev: SSEEvent) => void;
  onContent?: (delta: string) => void;
  onProfileReady?: () => void;
  onDone?: () => void;
}

interface UseSSEResult {
  status: SSEStatus;
  content: string;
  error: Error | null;
  start: (body?: unknown) => Promise<void>;
  abort: () => void;
  reset: () => void;
}

/**
 * SSE hook：POST + ReadableStream 逐行解析。
 * 后端为 text/event-stream（无 event: 字段），EventSource 不适用。
 */
export function useSSE({ url, onEvent, onContent, onProfileReady, onDone }: UseSSEOptions): UseSSEResult {
  const [status, setStatus] = useState<SSEStatus>('idle');
  const [content, setContent] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const statusRef = useRef<SSEStatus>('idle');
  const setInviteVerified = useAuthStore((s) => s.setInviteVerified);

  const setStatusBoth = useCallback((s: SSEStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const start = useCallback(
    async (body?: unknown) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setContent('');
      setStatusBoth('loading');

      try {
        const token = getToken();
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body ?? {}),
          signal: controller.signal,
        });

        if (resp.status === 403) {
          // 邀请码失效
          setInviteVerified(false);
          forceLogout();
          throw new ApiError('邀请码已失效，请重新验证', 403);
        }
        if (!resp.ok) {
          let detail = `请求失败 (${resp.status})`;
          try {
            const errBody = await resp.json();
            if (typeof errBody.detail === 'string') detail = errBody.detail;
          } catch {
            /* ignore */
          }
          throw new ApiError(detail, resp.status);
        }

        setStatusBoth('streaming');
        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let reachedDone = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const ev = parseSSELine(line);
            if (!ev) continue;
            onEvent?.(ev);
            if (ev.type === 'content') {
              onContent?.(ev.content);
              setContent((c) => c + ev.content);
            } else if (ev.type === 'profile_ready') {
              onProfileReady?.();
            } else if (ev.type === 'done') {
              reachedDone = true;
              setStatusBoth('done');
              onDone?.();
            }
          }
        }
        if (!reachedDone && statusRef.current === 'streaming') setStatusBoth('done');
      } catch (e) {
        if (controller.signal.aborted) {
          setStatusBoth('idle');
          return;
        }
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        setStatusBoth('error');
      }
    },
    [url, onEvent, onContent, onProfileReady, onDone, setInviteVerified, setStatusBoth],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setContent('');
    setError(null);
    setStatusBoth('idle');
  }, [setStatusBoth]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { status, content, error, start, abort, reset };
}
