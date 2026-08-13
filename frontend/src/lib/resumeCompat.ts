import type { ModuleType, ResumeModule, ResumeSnapshot, SnapshotSection } from '../types/resume';
import { STORAGE_KEYS } from './storage';

/** 旧 schema type → 新 module_type */
export const OLD_TYPE_MAP: Record<string, ModuleType> = {
  basic: 'basic_info',
  education: 'education',
  experience: 'experience',
  project: 'experience', // project 并入 experience
  skill: 'skill',
  summary: 'summary',
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * 规范化简历模块。兼容两套命名：
 * - 新 schema：m.module_type（basic_info/experience/education/award/skill/summary）
 * - 旧 schema：m.type（basic/education/experience/project/skill）
 * 未知 type 丢弃；缺字段补默认。
 */
export function normalizeResumeModule(raw: unknown): ResumeModule | null {
  if (!isPlainObject(raw)) return null;
  const m = raw as Record<string, unknown>;

  let moduleType: ModuleType | undefined;
  if (typeof m.module_type === 'string' && m.module_type in OLD_TYPE_MAP) {
    // 新命名已存在：直接透传（m.module_type 为 basic_info 等新名时 OLD_TYPE_MAP 无对应值，
    // 此处仅用于识别，实际取值走下方校验）
    moduleType = OLD_TYPE_MAP[m.module_type] ?? (m.module_type as ModuleType);
  } else if (typeof m.type === 'string') {
    moduleType = OLD_TYPE_MAP[m.type];
  }
  if (!moduleType) return null;

  const now = new Date().toISOString();
  return {
    id: typeof m.id === 'string' && m.id ? m.id : `mod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    module_type: moduleType,
    tags: Array.isArray(m.tags) ? m.tags.filter((t): t is string => typeof t === 'string') : [],
    is_deleted: m.is_deleted === true,
    created_at: typeof m.created_at === 'string' ? m.created_at : now,
    updated_at: typeof m.updated_at === 'string' ? m.updated_at : now,
    source: m.source === 'ai_generated' || m.source === 'upload' ? m.source : 'manual',
    cloned_from: typeof m.cloned_from === 'string' ? m.cloned_from : null,
    data: isPlainObject(m.data) ? m.data : {},
  };
}

/** 规范化快照：兼容缺 order/content 键的老数据 */
export function normalizeSnapshot(raw: unknown): ResumeSnapshot | null {
  if (!isPlainObject(raw)) return null;
  const s = raw as Record<string, unknown>;

  const rawSections = Array.isArray(s.sections) ? s.sections : [];
  const sections: SnapshotSection[] = [];
  rawSections.forEach((secRaw, idx) => {
    if (!isPlainObject(secRaw)) return;
    const sec = secRaw as Record<string, unknown>;
    const moduleType = normalizeResumeModule(sec);
    if (!moduleType) return;
    sections.push({
      module_type: moduleType.module_type,
      order: typeof sec.order === 'number' ? sec.order : idx,
      content: isPlainObject(sec.content) ? sec.content : moduleType.data,
    });
  });

  const now = new Date().toISOString();
  return {
    id: typeof s.id === 'string' && s.id ? s.id : `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: typeof s.name === 'string' ? s.name : '未命名快照',
    target_tags: Array.isArray(s.target_tags) ? s.target_tags.filter((t): t is string => typeof t === 'string') : [],
    created_at: typeof s.created_at === 'string' ? s.created_at : now,
    updated_at: typeof s.updated_at === 'string' ? s.updated_at : now,
    sections,
  };
}

/** 读 yesjob_resume_modules 的统一入口 */
export function parseResumeModulesLS(raw: string | null): ResumeModule[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(normalizeResumeModule)
    .filter((m): m is ResumeModule => m !== null && !m.is_deleted);
}

/** 读 yesjob_resume_snapshots 的统一入口 */
export function parseResumeSnapshotsLS(raw: string | null): ResumeSnapshot[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(normalizeSnapshot)
    .filter((s): s is ResumeSnapshot => s !== null);
}

export function readResumeModules(): ResumeModule[] {
  return parseResumeModulesLS(localStorage.getItem(STORAGE_KEYS.resumeModules));
}
