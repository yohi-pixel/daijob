export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  return (
    <div className="flex items-center justify-center py-8">
      <div className={`${dim} border-2 border-primary/30 border-t-primary rounded-full animate-spin`} />
    </div>
  );
}
