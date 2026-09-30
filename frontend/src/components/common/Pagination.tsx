import { Icon } from './Icon';

interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const navBtn =
  'flex h-8 min-w-8 items-center justify-center rounded-md border border-line px-2 text-meta text-muted transition-colors hover:border-outline hover:text-ink disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted';

/** 5 页窗口 + 前后页 */
export function Pagination({ total, page, pageSize, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const windowEnd = Math.min(totalPages, windowStart + 4);
  const pages: number[] = [];
  for (let p = windowStart; p <= windowEnd; p++) pages.push(p);

  return (
    <nav className="mt-6 flex items-center justify-center gap-1.5" aria-label="分页">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={navBtn}
        aria-label="上一页"
      >
        <Icon name="chevron_left" size={16} />
      </button>

      {windowStart > 1 && (
        <>
          <button type="button" onClick={() => onPageChange(1)} className={`${navBtn} num`}>
            1
          </button>
          <span className="px-1 text-meta text-muted">…</span>
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          aria-current={p === page ? 'page' : undefined}
          className={`num h-8 min-w-8 rounded-md px-2 text-meta transition-colors ${
            p === page
              ? 'bg-primary font-medium text-on-primary'
              : 'border border-line text-muted hover:border-outline hover:text-ink'
          }`}
        >
          {p}
        </button>
      ))}

      {windowEnd < totalPages && (
        <>
          <span className="px-1 text-meta text-muted">…</span>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            className={`${navBtn} num`}
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={navBtn}
        aria-label="下一页"
      >
        <Icon name="chevron_right" size={16} />
      </button>
    </nav>
  );
}
