import type { ModuleType, ResumeModule, ResumeSnapshot } from '../types/resume';
import { EXPERIENCE_TYPES, QUOTA } from '../types/resume';

export interface QuotaResult {
  ok: boolean;
  message?: string;
}

/** 配额检查纯函数。countByType 由调用方注入，便于测试。 */
export function checkQuota(
  type: ModuleType,
  countByType: (t: ModuleType) => number,
): QuotaResult {
  if (type === 'basic_info') {
    const count = countByType('basic_info');
    if (count >= QUOTA.basic_info)
      return { ok: false, message: `基本信息最多保存 ${QUOTA.basic_info} 条` };
  } else if (type === 'summary') {
    const count = countByType('summary');
    if (count >= QUOTA.summary)
      return { ok: false, message: `自我描述最多保存 ${QUOTA.summary} 条` };
  } else if (type === 'skill') {
    const count = countByType('skill');
    if (count >= QUOTA.skill)
      return { ok: false, message: `技能模块最多保存 ${QUOTA.skill} 条` };
  } else if (EXPERIENCE_TYPES.includes(type)) {
    const count = EXPERIENCE_TYPES.reduce((sum, t) => sum + countByType(t), 0);
    if (count >= QUOTA.experience)
      return { ok: false, message: `经历类模块合计最多 ${QUOTA.experience} 条` };
  }
  return { ok: true };
}

export interface QuotaStatus {
  basic_info: { used: number; max: number };
  experience: { used: number; max: number };
  summary: { used: number; max: number };
  skill: { used: number; max: number };
  snapshots: { used: number; max: number };
}

export function getQuotaStatus(
  modules: ResumeModule[],
  snapshots: ResumeSnapshot[],
): QuotaStatus {
  const active = modules.filter((m) => !m.is_deleted);
  const countByType = (t: ModuleType) => active.filter((m) => m.module_type === t).length;
  const expCount = EXPERIENCE_TYPES.reduce((sum, t) => sum + countByType(t), 0);
  return {
    basic_info: { used: countByType('basic_info'), max: QUOTA.basic_info },
    experience: { used: expCount, max: QUOTA.experience },
    summary: { used: countByType('summary'), max: QUOTA.summary },
    skill: { used: countByType('skill'), max: QUOTA.skill },
    snapshots: { used: snapshots.length, max: QUOTA.snapshots },
  };
}

/** 软删除后是否释放配额（软删模块不占配额） */
export function isDeleted(m: ResumeModule): boolean {
  return m.is_deleted === true;
}
