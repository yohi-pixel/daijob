import type { JobSummary } from './job';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type SSEEvent =
  | { type: 'content'; content: string }
  | { type: 'profile_ready' }
  | { type: 'done' };

export interface MatchResult {
  scores: Record<string, number | null>;
}

export interface RecommendResponse {
  jobs: JobSummary[];
}

export interface ExtractedResumeModule {
  type: string;
  data: Record<string, unknown>;
}

export interface UserProfile {
  name?: string;
  education?: Array<Record<string, unknown>>;
  experiences?: Array<Record<string, unknown>>;
  skills?: string[];
  target_role?: string;
  target_city?: string;
  recruit_type?: string;
}
