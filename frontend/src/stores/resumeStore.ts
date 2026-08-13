import { create } from 'zustand';
import type { ModuleType, ResumeModule, SerializedModuleData } from '../types/resume';
import { STORAGE_KEYS, getJSON, setJSON } from '../lib/storage';
import { checkQuota } from '../lib/resumeQuota';

interface ResumeState {
  modules: ResumeModule[];
  currentType: ModuleType | 'all';
  activeTag: string | null;
  editingId: string | null;
  formTags: string[];
  hydrate: () => void;
  getByType: (t: ModuleType | 'all') => ResumeModule[];
  getByTag: (tag: string | null) => ResumeModule[];
  allTags: () => string[];
  countByType: (t: ModuleType) => number;
  addModule: (type: ModuleType, data: SerializedModuleData, tags?: string[]) => void;
  updateModule: (id: string, patch: { data?: SerializedModuleData; tags?: string[] }) => void;
  deleteModule: (id: string) => void;
  cloneModule: (id: string) => void;
  setCurrentType: (t: ModuleType | 'all') => void;
  setActiveTag: (tag: string | null) => void;
  setEditingId: (id: string | null) => void;
  setFormTags: (tags: string[]) => void;
}

function generateId(prefix = 'mod'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function persist(modules: ResumeModule[]): void {
  setJSON(STORAGE_KEYS.resumeModules, modules);
}

export const useResumeStore = create<ResumeState>((set, get) => ({
  modules: getJSON<ResumeModule[]>(STORAGE_KEYS.resumeModules) ?? [],
  currentType: 'all',
  activeTag: null,
  editingId: null,
  formTags: [],

  hydrate: () => {
    set({ modules: getJSON<ResumeModule[]>(STORAGE_KEYS.resumeModules) ?? [] });
  },

  getByType: (t) => {
    const active = get().modules.filter((m) => !m.is_deleted);
    if (t === 'all') return active;
    return active.filter((m) => m.module_type === t);
  },

  getByTag: (tag) => {
    const active = get().modules.filter((m) => !m.is_deleted);
    if (!tag) return active;
    return active.filter((m) => m.tags?.includes(tag));
  },

  allTags: () => {
    const tags = new Set<string>();
    get()
      .modules.filter((m) => !m.is_deleted)
      .forEach((m) => (m.tags || []).forEach((t) => tags.add(t)));
    return [...tags].sort();
  },

  countByType: (t) => get().modules.filter((m) => !m.is_deleted && m.module_type === t).length,

  addModule: (type, data, tags = []) => {
    const quota = checkQuota(type, (t) => get().countByType(t));
    if (!quota.ok) throw new Error(quota.message);
    const now = new Date().toISOString();
    const module: ResumeModule = {
      id: generateId('mod'),
      module_type: type,
      tags,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      source: 'manual',
      cloned_from: null,
      data,
    };
    const next = [module, ...get().modules];
    persist(next);
    set({ modules: next, formTags: [] });
  },

  updateModule: (id, patch) => {
    const next = get().modules.map((m) =>
      m.id === id
        ? {
            ...m,
            ...(patch.data !== undefined ? { data: patch.data } : {}),
            ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
            updated_at: new Date().toISOString(),
          }
        : m,
    );
    persist(next);
    set({ modules: next });
  },

  deleteModule: (id) => {
    const next = get().modules.map((m) =>
      m.id === id ? { ...m, is_deleted: true, updated_at: new Date().toISOString() } : m,
    );
    persist(next);
    set({ modules: next, editingId: null });
  },

  cloneModule: (id) => {
    const original = get().modules.find((m) => m.id === id && !m.is_deleted);
    if (!original) throw new Error('模块不存在');
    const quota = checkQuota(original.module_type, (t) => get().countByType(t));
    if (!quota.ok) throw new Error(quota.message);
    const now = new Date().toISOString();
    const cloned: ResumeModule = {
      ...JSON.parse(JSON.stringify(original)),
      id: generateId('mod'),
      cloned_from: original.id,
      source: 'manual',
      created_at: now,
      updated_at: now,
    };
    const origIdx = get().modules.findIndex((m) => m.id === id);
    const next = [...get().modules];
    next.splice(origIdx + 1, 0, cloned);
    persist(next);
    set({ modules: next });
  },

  setCurrentType: (t) => set({ currentType: t }),
  setActiveTag: (tag) => set({ activeTag: tag }),
  setEditingId: (id) => set({ editingId: id }),
  setFormTags: (tags) => set({ formTags: tags }),
}));
