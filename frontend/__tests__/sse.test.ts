import { describe, it, expect } from 'vitest';
import { parseSSELine } from '../src/lib/sse';

/** 模拟流式分段：把整串 SSE 切成多个 chunk 逐一喂给解析器，验证不丢不错 */
function simulateChunks(input: string, chunkSize: number): ReturnType<typeof parseSSELine>[] {
  const events: ReturnType<typeof parseSSELine>[] = [];
  let buffer = '';
  for (let i = 0; i < input.length; i += chunkSize) {
    buffer += input.slice(i, i + chunkSize);
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const ev = parseSSELine(line);
      if (ev) events.push(ev);
    }
  }
  // 处理残留 buffer
  if (buffer.trim()) {
    const ev = parseSSELine(buffer);
    if (ev) events.push(ev);
  }
  return events;
}

describe('parseSSELine', () => {
  it('解析 content 事件', () => {
    expect(parseSSELine('data: {"content": "你好"}')).toEqual({ type: 'content', content: '你好' });
  });

  it('解析 profile_ready 事件', () => {
    expect(parseSSELine('data: {"profile_ready": true}')).toEqual({ type: 'profile_ready' });
  });

  it('解析 [DONE]', () => {
    expect(parseSSELine('data: [DONE]')).toEqual({ type: 'done' });
  });

  it('空行返回 null', () => {
    expect(parseSSELine('')).toBeNull();
    expect(parseSSELine('  ')).toBeNull();
  });

  it('非 data: 前缀返回 null', () => {
    expect(parseSSELine('event: message')).toBeNull();
    expect(parseSSELine('id: 1')).toBeNull();
  });

  it('畸形 JSON 返回 null', () => {
    expect(parseSSELine('data: {broken')).toBeNull();
  });

  it('未知字段返回 null', () => {
    expect(parseSSELine('data: {"foo": 1}')).toBeNull();
  });

  it('流式分段解析结果一致（事件在中间断开）', () => {
    const input = [
      'data: {"content": "你好"}\n\n',
      'data: {"content": "，"}\n\n',
      'data: {"profile_ready": true}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    // 不同 chunk 大小，结果应一致
    for (const size of [1, 3, 7, 13, 50]) {
      const events = simulateChunks(input, size);
      const contents = events.filter((e) => e?.type === 'content').map((e) => (e as { content: string }).content);
      expect(contents.join('')).toBe('你好，');
      expect(events.some((e) => e?.type === 'profile_ready')).toBe(true);
      expect(events.some((e) => e?.type === 'done')).toBe(true);
    }
  });
});
