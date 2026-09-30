/**
 * 新鲜度标记 —— 全站唯一使用信号黄的地方。
 *
 * 分两档：只有「今天发布」才用实心块，1–7 天用轻量标记。
 * 原因很实在：默认按最新排序时首屏可能一整屏都是 7 天内的岗位，
 * 如果全部实心，一屏十几个琥珀块就不再是信号，而是装饰。
 */
export function FreshPill({
  label,
  variant = 'solid',
}: {
  label: string;
  variant?: 'solid' | 'quiet';
}) {
  if (variant === 'quiet') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-micro font-medium text-signal-ink">
        <span className="h-1.5 w-1.5 rounded-full bg-signal" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-signal-soft px-1.5 py-px text-micro font-medium text-signal-ink">
      <span className="h-1.5 w-1.5 rounded-full bg-signal" />
      {label}
    </span>
  );
}
