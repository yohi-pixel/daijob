import { apiFetch } from '../lib/apiClient';
import type {
  DynamicFiltersResponse,
  FiltersResponse,
  JobDetail,
  JobListResponse,
  JobQueryParams,
} from '../types/job';
import type { MatchResult } from '../types/ai';

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function getJobs(params: JobQueryParams = {}): Promise<JobListResponse> {
  return apiFetch<JobListResponse>(`/jobs${buildQuery(params as Record<string, unknown>)}`);
}

export async function getJobDetail(jobId: string): Promise<JobDetail> {
  return apiFetch<JobDetail>(`/jobs/${jobId}`);
}

export async function getFilters(): Promise<FiltersResponse> {
  return apiFetch<FiltersResponse>('/jobs/meta/filters');
}

export async function getDynamicFilters(params: Partial<JobQueryParams> = {}): Promise<DynamicFiltersResponse> {
  return apiFetch<DynamicFiltersResponse>(`/jobs/meta/dynamic-filters${buildQuery(params as Record<string, unknown>)}`);
}

export async function matchJobs(resumeText: string, jobIds: number[]): Promise<MatchResult> {
  return apiFetch<MatchResult>('/ai/match', {
    method: 'POST',
    body: { resume_text: resumeText, job_ids: jobIds },
  });
}
