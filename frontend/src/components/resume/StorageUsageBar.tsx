import { useResumeStore } from '../../stores/resumeStore';
import { useResumeSnapshotsStore } from '../../stores/resumeSnapshotsStore';
import { getQuotaStatus } from '../../lib/resumeQuota';
import { MODULE_TYPE_LABELS } from '../../types/resume';

/**
 * 用量。原先每行一根进度条，但配额小、初始全为 0 —— 五根空条读不出任何信息。
 * 改成「还剩多少可加」先说结论，再列每组明细，容量是拿来判断能不能再写的。
 */
export function StorageUsageBar() {
  const modules = useResumeStore((s) => s.modules);
  const snapshots = useResumeSnapshotsStore((s) => s.snapshots);
  const status = getQuotaStatus(modules, snapshots);

  const groups = [
    { label: MODULE_TYPE_LABELS.basic_info, used: status.basic_info.used, max: status.basic_info.max },
    { label: '经历类', used: status.experience.used, max: status.experience.max },
    { label: MODULE_TYPE_LABELS.summary, used: status.summary.used, max: status.summary.max },
    { label: MODULE_TYPE_LABELS.skill, used: status.skill.used, max: status.skill.max },
    { label: '快照', used: status.snapshots.used, max: status.snapshots.max },
  ];

  const usedModules =
    status.basic_info.used + status.experience.used + status.summary.used + status.skill.used;
  const maxModules =
    status.basic_info.max + status.experience.max + status.summary.max + status.skill.max;
  const roomModules = Math.max(0, maxModules - usedModules);
  const roomSnapshots = Math.max(0, status.snapshots.max - status.snapshots.used);
  const anyFull = groups.some((g) => g.used >= g.max);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-meta text-ink">
        {roomModules > 0 ? (
          <>
            还能加 <span className="num font-medium">{roomModules}</span> 个模块
          </>
        ) : (
          <span className="font-medium">模块已加到上限</span>
        )}
        <span className="mx-1.5 text-line">·</span>
        {roomSnapshots > 0 ? (
          <>
            <span className="num font-medium">{roomSnapshots}</span> 个快照
          </>
        ) : (
          <span className="font-medium">快照已满</span>
        )}
      </span>

      <span className="flex flex-wrap gap-1.5">
        {groups.map((g) => {
          const full = g.used >= g.max;
          return (
            <span
              key={g.label}
              className={`num rounded-sm border px-1.5 py-px text-micro ${
                full ? 'border-error/40 text-error' : 'border-line text-muted'
              }`}
            >
              {g.label} {g.used}/{g.max}
            </span>
          );
        })}
      </span>

      {anyFull && (
        <span className="text-micro text-error">标红的类目已满，要再加得先删掉一条</span>
      )}
    </div>
  );
}
