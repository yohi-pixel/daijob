/**
 * resume-ai.js
 * Module-level AI optimization via backend /api/ai/optimize-module (SSE).
 */

import { getToken } from './api.js';

/**
 * Call backend streaming endpoint to optimize a resume module.
 * @param {object} module - Resume module object with module_type and data fields
 * @param {number|string|null} jobId - Optional saved job ID for JD-targeted optimization
 * @param {function} onChunk - Called with each streamed text chunk
 * @returns {Promise<void>}
 */
export async function optimizeModuleWithAI(module, jobId, onChunk) {
  const token = getToken();
  const resp = await fetch('/api/ai/optimize-module', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      module_type: module.module_type,
      module_data: module.data,
      job_id: jobId ? Number(jobId) : null,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`AI 服务错误 ${resp.status}: ${err.slice(0, 200)}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        if (json.content) onChunk(json.content);
      } catch { /* skip malformed SSE line */ }
    }
  }
}
