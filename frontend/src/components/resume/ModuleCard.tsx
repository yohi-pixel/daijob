import type { ResumeModule } from '../../types/resume';
import { MODULE_TYPE_LABELS } from '../../types/resume';

interface ModuleCardProps {
  module: ResumeModule;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

function summaryText(m: ResumeModule): string {
  const d = m.data || {};
  switch (m.module_type) {
    case 'basic_info':
      return [d.name, d.phone, d.email].filter(Boolean).join(' · ');
    case 'experience':
      return [d.org, d.role].filter(Boolean).join(' · ');
    case 'education':
      return [d.school, d.degree, d.major].filter(Boolean).join(' · ');
    case 'skill':
      return Array.isArray(d.items) ? d.items.join('、') : str(d.category);
    case 'award':
      return str(d.name);
    case 'summary':
      return str(d.content).slice(0, 60);
    default:
      return '';
  }
}

export function ModuleCard({ module, onEdit, onClone, onDelete }: ModuleCardProps) {
  return (
    <div className="group bg-surface rounded-2xl border border-outline-variant/20 p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-on-primary bg-primary-container/30 px-2 py-0.5 rounded-full">
          {MODULE_TYPE_LABELS[module.module_type]}
        </span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} title="编辑" className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-[17px]">edit</span>
          </button>
          <button onClick={onClone} title="复制" className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-[17px]">copy</span>
          </button>
          <button onClick={onDelete} title="删除" className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-[17px]">delete</span>
          </button>
        </div>
      </div>
      <p className="text-sm text-on-surface mt-2 line-clamp-2">{summaryText(module)}</p>
      {module.tags && module.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {module.tags.map((t) => (
            <span key={t} className="text-[11px] bg-surface-container-low px-2 py-0.5 rounded-full text-on-surface-variant">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
