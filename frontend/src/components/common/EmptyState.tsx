import { Icon } from './Icon';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export function EmptyState({ icon = 'inbox', title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <Icon name={icon} size={30} className="text-line" />
      <p className="mt-3 text-lead font-medium text-ink">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-body text-muted">{description}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <Icon name="error" size={30} className="text-error" />
      <p className="mt-3 text-lead font-medium text-ink">没能加载出来</p>
      <p className="mt-1.5 max-w-sm text-body text-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-md border border-ink/25 px-3.5 py-2 text-body font-medium text-ink transition-colors hover:border-ink"
        >
          重试
        </button>
      )}
    </div>
  );
}
