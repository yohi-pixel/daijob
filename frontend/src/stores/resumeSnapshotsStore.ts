import { create } from 'zustand';
import type { ResumeSnapshot, SnapshotSection } from '../types/resume';
import { QUOTA } from '../types/resume';
import { STORAGE_KEYS, getJSON, setJSON } from '../lib/storage';

interface ResumeSnapshotsState {
  snapshots: ResumeSnapshot[];
  hydrate: () => void;
  addSnapshot: (name: string, targetTags: string[], sections: SnapshotSection[]) => void;
  updateSnapshot: (id: string, patch: { name?: string; targetTags?: string[]; sections?: SnapshotSection[] }) => void;
  deleteSnapshot: (id: string) => void;
}

function generateId(prefix = 'snap'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function persist(snapshots: ResumeSnapshot[]): void {
  setJSON(STORAGE_KEYS.resumeSnapshots, snapshots);
}

export const useResumeSnapshotsStore = create<ResumeSnapshotsState>((set, get) => ({
  snapshots: getJSON<ResumeSnapshot[]>(STORAGE_KEYS.resumeSnapshots) ?? [],

  hydrate: () => {
    set({ snapshots: getJSON<ResumeSnapshot[]>(STORAGE_KEYS.resumeSnapshots) ?? [] });
  },

  addSnapshot: (name, targetTags, sections) => {
    if (get().snapshots.length >= QUOTA.snapshots)
      throw new Error(`简历快照最多保存 ${QUOTA.snapshots} 份`);
    const now = new Date().toISOString();
    const snapshot: ResumeSnapshot = {
      id: generateId('snap'),
      name,
      target_tags: targetTags,
      created_at: now,
      updated_at: now,
      sections: JSON.parse(JSON.stringify(sections)),
    };
    const next = [snapshot, ...get().snapshots];
    persist(next);
    set({ snapshots: next });
  },

  updateSnapshot: (id, patch) => {
    const next = get().snapshots.map((s) =>
      s.id === id
        ? {
            ...s,
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.targetTags !== undefined ? { target_tags: patch.targetTags } : {}),
            ...(patch.sections !== undefined ? { sections: JSON.parse(JSON.stringify(patch.sections)) } : {}),
            updated_at: new Date().toISOString(),
          }
        : s,
    );
    persist(next);
    set({ snapshots: next });
  },

  deleteSnapshot: (id) => {
    const next = get().snapshots.filter((s) => s.id !== id);
    persist(next);
    set({ snapshots: next });
  },
}));
