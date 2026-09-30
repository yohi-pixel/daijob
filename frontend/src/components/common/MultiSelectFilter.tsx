import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  value: string[];
  onToggle: (opt: string) => void;
  /** 触发器宽度上限（桌面上四组筛选要挤在同一行） */
  triggerClassName?: string;
}

/**
 * 多选筛选。桌面是锚在触发器下的浮层，移动端变成贴底抽屉 ——
 * 纯靠响应式类切换，不引 JS 媒体查询。移动端原先四个下拉占掉四成首屏，
 * 现在收敛成一行可横滑的触发器。
 */
export function MultiSelectFilter({
  label,
  options,
  value,
  onToggle,
  triggerClassName = 'max-w-[9rem]',
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  // 选项多（城市 200+）时要能就地过滤
  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const hasValue = value.length > 0;

  return (
    <>
      <div ref={ref} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`flex h-9 w-full items-center gap-1.5 rounded-md border px-2.5 text-body transition-colors ${triggerClassName} ${
            open
              ? 'border-ink bg-surface'
              : hasValue
                ? 'border-ink/30 bg-surface-container text-ink'
                : 'border-line bg-surface text-muted hover:border-outline hover:text-ink'
          }`}
        >
          <span className="truncate">{label}</span>
          {hasValue && <span className="num shrink-0 text-micro text-muted">{value.length}</span>}
          <Icon
            name="chevron_down"
            size={15}
            className={`ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="fixed inset-x-0 bottom-0 z-[60] max-h-[70vh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-lg md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-full md:mt-1.5 md:max-h-80 md:w-72 md:rounded-xl md:border md:pb-0 md:shadow-md">
            <div className="flex items-center justify-between px-4 pb-2 pt-3.5 md:px-3 md:pt-3">
              <span className="text-body font-medium text-ink">{label}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted hover:text-ink md:hidden"
                aria-label="关闭"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {options.length > 12 && (
              <div className="px-4 pb-2 md:px-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`在 ${options.length} 个选项里查找`}
                  aria-label={`查找${label}选项`}
                  className="h-8 w-full rounded-md border border-line bg-surface-container-low px-2.5 text-meta text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-0"
                />
              </div>
            )}

            <div className="px-2 pb-2 md:max-h-56 md:overflow-y-auto">
              {filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-meta text-muted">
                  没有匹配「{query}」的选项
                </p>
              )}
              {filtered.map((opt) => {
                const selected = value.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onToggle(opt)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-body transition-colors ${
                      selected
                        ? 'bg-surface-container text-ink'
                        : 'text-ink hover:bg-surface-container-low'
                    }`}
                  >
                    <Icon
                      name={selected ? 'check_box' : 'check_box_outline_blank'}
                      size={17}
                      className={selected ? 'text-ink' : 'text-line'}
                    />
                    <span className="truncate">{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 移动端遮罩：点击冒泡到 document 的 mousedown 即关闭 */}
      {open && <div className="fixed inset-0 z-[55] bg-ink/25 md:hidden" />}
    </>
  );
}
