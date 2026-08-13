import { apiFetch } from '../lib/apiClient';
import type { ExtractedResumeModule, MatchResult, RecommendResponse } from '../types/ai';

export const SSE_ENDPOINTS = {
  chat: '/api/ai/chat',
  optimizeModule: '/api/ai/optimize-module',
  analyzeJobFit: '/api/ai/analyze-job-fit',
} as const;

export async function verifyInvite(code: string): Promise<{ message: string }> {
  return apiFetch('/ai/verify-invite', {
    method: 'POST',
    body: { code },
  });
}

export async function optimizeResume(resumeText: string, jobId: number): Promise<{ optimized_resume: string; suggestions: string[] }> {
  return apiFetch('/ai/optimize', {
    method: 'POST',
    body: { resume_text: resumeText, job_id: jobId },
  });
}

export async function matchJobs(resumeText: string, jobIds: number[]): Promise<MatchResult> {
  return apiFetch<MatchResult>('/ai/match', {
    method: 'POST',
    body: { resume_text: resumeText, job_ids: jobIds },
  });
}

export async function recommendJobs(topK = 10): Promise<RecommendResponse> {
  return apiFetch<RecommendResponse>('/ai/recommend-jobs', {
    method: 'POST',
    body: { top_k: topK },
  });
}

export async function extractResume(): Promise<{ modules: ExtractedResumeModule[] }> {
  return apiFetch('/ai/extract-resume', {
    method: 'POST',
    body: {},
  });
}

export async function getProfile(): Promise<Record<string, unknown>> {
  return apiFetch('/ai/profile');
}

export async function uploadResumeParse(file: File, hasBasicInfo = false): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append('file', file);
  form.append('has_basic_info', String(hasBasicInfo));
  const url = '/api/resume/parse';
  const headers: Record<string, string> = {};
  const token = localStorage.getItem('yesjob_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const resp = await fetch(url, { method: 'POST', body: form, headers });
  if (!resp.ok) {
    let detail = `请求失败 (${resp.status})`;
    try {
      const errBody = await resp.json();
      if (typeof errBody.detail === 'string') detail = errBody.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return resp.json();
}
