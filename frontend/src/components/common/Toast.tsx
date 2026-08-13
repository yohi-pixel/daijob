import { useToast } from '../../hooks/useToast';

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  const colorMap = {
    success: 'bg-primary text-on-primary',
    error: 'bg-error text-on-error',
    info: 'bg-inverse-surface text-inverse-on-surface',
  } as const;

  return (
    <div className="fixed top-20 right-4 z-[200] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${colorMap[t.type]} px-4 py-2.5 rounded-xl shadow-lg text-sm flex items-center gap-2`}
        >
          <span>{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ))}
    </div>
  );
}
