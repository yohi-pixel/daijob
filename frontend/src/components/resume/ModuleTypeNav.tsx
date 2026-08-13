import type { ModuleType } from '../../types/resume';
import { MODULE_TYPE_LABELS, QUOTA, EXPERIENCE_TYPES } from '../../types/resume';
import { useResumeStore } from '../../stores/resumeStore';

const TYPES: Array<ModuleType | 'all'> = ['all', ...EXPERIENCE_TYPES, 'basic_info', 'skill', 'summary'];

/** 6 类型导航 + 配额徽标 */
export function ModuleTypeNav() {
  const currentType = useResumeStore((s) => s.currentType);
  const setCurrentType = useResumeStore((s) => s.setCurrentType);
  const modules = useResumeStore((s) => s.modules);
  const active = modules.filter((m) => !m.is_deleted);

  const countFor = (t: ModuleType | 'all') =>
    t === 'all' ? active.length : active.filter((m) => m.module_type === t).length;

  const maxFor = (t: ModuleType) => {
    if (t === 'basic_info') return QUOTA.basic_info;
    if (t === 'summary') return QUOTA.summary;
    if (t === 'skill') return QUOTA.skill;
    return QUOTA.experience; // 经历类合计
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {TYPES.map((t) => {
        const count = countFor(t);
        const max = t === 'all' ? null : maxFor(t as ModuleType);
        const isOver = max !== null && count >= max;
        return (
          <button
            key={t}
            onClick={() => setCurrentType(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              currentType === t
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {t === 'all' ? '全部' : MODULE_TYPE_LABELS[t as ModuleType]}
            <span className={`ml-1 ${isOver ? 'text-error' : 'opacity-60'}`}>
              {count}
              {max !== null && `/${max}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
