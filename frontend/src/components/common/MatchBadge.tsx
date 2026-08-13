export function MatchBadge({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary bg-primary-container/20 rounded-full px-2 py-0.5">
      <span className="material-symbols-outlined text-[13px]">bolt</span>
      匹配 {score}%
    </span>
  );
}
