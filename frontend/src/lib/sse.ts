import type { SSEEvent } from '../types/ai';

/**
 * 解析单行 SSE 数据。后端格式（已验证）：
 * - 无 event: 字段，仅 data: 行
 * - data: {"content": "文本增量"}
 * - data: {"profile_ready": true}   （仅 chat 端点）
 * - data: [DONE]                     结尾
 * 空行分隔。
 */
export function parseSSELine(line: string): SSEEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed === 'data: [DONE]') return { type: 'done' };
  if (!trimmed.startsWith('data: ')) return null;
  try {
    const json = JSON.parse(trimmed.slice(6));
    if (typeof json.content === 'string') return { type: 'content', content: json.content };
    if (json.profile_ready === true) return { type: 'profile_ready' };
    return null;
  } catch {
    return null; // 跳过畸形行
  }
}
