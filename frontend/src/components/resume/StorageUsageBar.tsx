import { useResumeStore } from '../../stores/resumeStore';
import { useResumeSnapshotsStore } from '../../stores/resumeSnapshotsStore';
import { getQuotaStatus } from '../../lib/resumeQuota';
import { MODULE_TYPE_LABELS } from '../../types/resume';

/** 存储用量进度条 + 警告 */
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

  return (
    <div className="space-y-1.5">
      {groups.map((g) => {
        const ratio = g.max > 0 ? g.used / g.max : 0;
        const full = g.used >= g.max;
        return (
          <div key={g.label} className="flex items-center gap-2">
            <span className="w-14 text-[11px] text-on-surface-variant shrink-0">{g.label}</span>
            <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${full ? 'bg-error' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, ratio * 100)}%` }}
              />
            </div>
            <span className={`text-[11px] w-10 text-right shrink-0 ${full ? 'text-error font-medium' : 'text-on-surface-variant'}`}>
              {g.used}/{g.max}
            </span>
          </div>
        );
      })}
    </div>
  );
}
