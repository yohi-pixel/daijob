interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export function EmptyState({ icon = 'inbox', title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="material-symbols-outlined text-5xl text-outline-variant mb-3">{icon}</span>
      <p className="font-medium text-on-surface">{title}</p>
      {description && <p className="text-sm text-on-surface-variant mt-1">{description}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="material-symbols-outlined text-5xl text-error mb-3">error</span>
      <p className="font-medium text-on-surface">加载失败</p>
      <p className="text-sm text-on-surface-variant mt-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 text-sm text-primary font-medium hover:underline"
        >
          重试
        </button>
      )}
    </div>
  );
}
