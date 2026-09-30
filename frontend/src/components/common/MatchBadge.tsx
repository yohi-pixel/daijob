import { Icon } from './Icon';

/**
 * 简历匹配度。刻意用墨色描边而不是彩色填充 ——
 * 彩色只留给「新鲜度」，否则两个信号互相抵消。
 */
export function MatchBadge({ score }: { score: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-ink/25 px-1.5 py-px text-micro font-medium text-ink">
      <Icon name="bolt" size={11} strokeWidth={2} />
      <span className="num">匹配 {score}%</span>
    </span>
  );
}
