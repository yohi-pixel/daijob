import { useResumeStore } from '../../stores/resumeStore';

/** 标签筛选 chips */
export function TagFilter() {
  const allTags = useResumeStore((s) => s.allTags());
  const activeTag = useResumeStore((s) => s.activeTag);
  const setActiveTag = useResumeStore((s) => s.setActiveTag);

  if (allTags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => setActiveTag(null)}
        className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
          activeTag === null ? 'bg-surface-container-high text-on-surface' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
        }`}
      >
        全部标签
      </button>
      {allTags.map((t) => (
        <button
          key={t}
          onClick={() => setActiveTag(activeTag === t ? null : t)}
          className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
            activeTag === t ? 'bg-primary-container/30 text-on-primary-container' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
