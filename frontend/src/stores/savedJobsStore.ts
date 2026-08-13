import { create } from 'zustand';
import type { JobSummary } from '../types/job';
import { STORAGE_KEYS, getJSON, setJSON } from '../lib/storage';

interface SavedJobsState {
  saved: JobSummary[];
  hydrate: () => void;
  isSaved: (id: number | string) => boolean;
  toggleSave: (job: JobSummary) => void;
  remove: (id: number | string) => void;
}

export const useSavedJobsStore = create<SavedJobsState>((set, get) => ({
  saved: getJSON<JobSummary[]>(STORAGE_KEYS.savedJobs) ?? [],

  hydrate: () => {
    const saved = getJSON<JobSummary[]>(STORAGE_KEYS.savedJobs) ?? [];
    set({ saved });
  },

  isSaved: (id) => {
    const key = String(id);
    return get().saved.some((j) => String(j.id) === key);
  },

  toggleSave: (job) => {
    const key = String(job.id);
    const current = get().saved;
    const exists = current.some((j) => String(j.id) === key);
    const next = exists ? current.filter((j) => String(j.id) !== key) : [job, ...current];
    setJSON(STORAGE_KEYS.savedJobs, next);
    set({ saved: next });
  },

  remove: (id) => {
    const key = String(id);
    const next = get().saved.filter((j) => String(j.id) !== key);
    setJSON(STORAGE_KEYS.savedJobs, next);
    set({ saved: next });
  },
}));
