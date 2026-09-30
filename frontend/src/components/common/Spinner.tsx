export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';
  return (
    <div className="flex items-center justify-center py-10" role="status" aria-label="加载中">
      <div className={`${dim} animate-spin rounded-full border-2 border-line border-t-ink`} />
    </div>
  );
}
