export const STORAGE_KEYS = {
  token: 'yesjob_token',
  user: 'yesjob_user',
  savedJobs: 'yesjob_saved_jobs',
  resumeModules: 'yesjob_resume_modules',
  resumeSnapshots: 'yesjob_resume_snapshots',
  resumeText: 'yesjob_resume_text',
  aiInviteVerified: 'yesjob_ai_invite_verified',
};

export function getJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeKey(key: string): void {
  localStorage.removeItem(key);
}
