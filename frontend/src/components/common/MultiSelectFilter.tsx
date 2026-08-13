import { useEffect, useRef, useState } from 'react';

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  value: string[];
  onToggle: (opt: string) => void;
  placeholder?: string;
}

/**
 * 多选筛选：chips + 下拉（选中态 ✓、点击外部关闭）。
 * 对应旧版 home.html 的 filter-dropdown / filter-multi / filter-chip 交互。
 */
export function MultiSelectFilter({ label, options, value, onToggle, placeholder }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (opt: string) => {
    onToggle(opt);
  };

  const clear = () => {
    value.forEach((v) => onToggle(v));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm border transition-colors ${
          open ? 'border-primary/60 ring-2 ring-primary/20' : 'border-outline-variant'
        } ${value.length > 0 ? 'bg-primary-container/10 text-on-primary-container' : 'bg-surface text-on-surface'}`}
      >
        <span className="truncate">
          {value.length > 0 ? `${label} (${value.length})` : placeholder ?? label}
        </span>
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full bg-surface border border-outline-variant/40 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          <div className="p-1.5">
            {options.length === 0 && (
              <p className="px-3 py-2 text-xs text-on-surface-variant">无选项</p>
            )}
            {options.map((opt) => {
              const selected = value.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggle(opt)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                    selected ? 'bg-primary-container/15 text-on-primary-container' : 'text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[18px] ${selected ? 'text-primary' : 'text-outline-variant'}`}
                  >
                    {selected ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                  <span className="truncate">{opt}</span>
                </button>
              );
            })}
          </div>
          {value.length > 0 && (
            <div className="border-t border-outline-variant/20 p-1.5">
              <button
                onClick={clear}
                className="w-full px-3 py-1.5 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container-low text-center"
              >
                清除选择
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
