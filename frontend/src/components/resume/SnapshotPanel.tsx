import { useResumeSnapshotsStore } from '../../stores/resumeSnapshotsStore';
import { useResumeStore } from '../../stores/resumeStore';
import { MODULE_TYPE_LABELS } from '../../types/resume';
import { exportSnapshotToPDF, exportSnapshotToWord, type ResumeTemplate } from '../../lib/resumeExport';
import { useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import { EmptyState } from '../common/EmptyState';

import { Icon } from '../common/Icon';
/** 打开时执行一次 reset 逻辑 */
function useResetOnOpen(open: boolean, reset: () => void): void {
  const prevOpen = useRef(false);
  if (open && !prevOpen.current) {
    reset();
  }
  prevOpen.current = open;
}

/** 快照面板：列表 + 新建（从当前模块组装）+ 导出 */
export function SnapshotPanel() {
  const snapshots = useResumeSnapshotsStore((s) => s.snapshots);
  const deleteSnapshot = useResumeSnapshotsStore((s) => s.deleteSnapshot);
  const modules = useResumeStore((s) => s.modules);
  const [createOpen, setCreateOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<{ id: string; name: string } | null>(null);
  const [template, setTemplate] = useState<ResumeTemplate>('classic');
  const [exporting, setExporting] = useState(false);

  const activeModules = modules.filter((m) => !m.is_deleted);

  const openExport = (id: string, name: string) => {
    setExportTarget({ id, name });
    setTemplate('classic');
  };

  const doExport = async () => {
    if (!exportTarget) return;
    const snap = snapshots.find((s) => s.id === exportTarget.id);
    if (!snap) return;
    setExporting(true);
    try {
      await exportSnapshotToPDF(snap, template);
      setExportTarget(null);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-on-surface">简历快照</h3>
        <button
          onClick={() => setCreateOpen(true)}
          disabled={activeModules.length === 0}
          className="text-xs font-medium text-ink border border-ink/25 px-3 py-1.5 rounded-lg hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + 新建快照
        </button>
      </div>

      {snapshots.length === 0 ? (
        <EmptyState icon="collections_bookmark" title="暂无快照" description="把当前模块保存为可导出的简历版本" />
      ) : (
        snapshots.map((s) => (
          <div key={s.id} className="bg-surface-container-low rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium text-sm text-on-surface truncate">{s.name}</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  {s.sections.length} 个模块
                  {s.target_tags.length > 0 && ` · ${s.target_tags.join('、')}`}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => openExport(s.id, s.name)}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-ink hover:bg-surface-container-high"
                  title="导出 PDF"
                >
                  <Icon name='picture_as_pdf' size={17} />
                </button>
                <button
                  onClick={() => exportSnapshotToWord(s)}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-ink hover:bg-surface-container-high"
                  title="导出 Word"
                >
                  <Icon name='description' size={17} />
                </button>
                <button
                  onClick={() => deleteSnapshot(s.id)}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-container-high"
                  title="删除"
                >
                  <Icon name='delete' size={17} />
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {/* 新建快照：从当前全部模块组装 */}
      <CreateSnapshotModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        modules={activeModules}
      />

      {/* 导出模板选择 */}
      <Modal open={!!exportTarget} onClose={() => setExportTarget(null)} title={`导出「${exportTarget?.name ?? ''}」`}>
        <div className="p-5 space-y-4">
          <p className="text-xs text-on-surface-variant">选择模板</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'classic', label: 'Classic', desc: '传统正式' },
                { id: 'modern', label: 'Modern', desc: '现代双栏' },
                { id: 'minimal', label: 'Minimal', desc: '极简线条' },
              ] as Array<{ id: ResumeTemplate; label: string; desc: string }>
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTemplate(t.id)}
                className={`p-3 rounded-xl border text-center transition-colors ${
                  template === t.id ? 'border-primary bg-surface-container' : 'border-line hover:border-ink/25'
                }`}
              >
                <p className="text-sm font-semibold text-on-surface">{t.label}</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
          <button
            onClick={doExport}
            disabled={exporting}
            className="w-full bg-primary text-on-primary font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
          >
            {exporting ? '导出中…' : '导出 PDF'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

/** 新建快照：选择模块（多选）+ 命名 */
function CreateSnapshotModal({
  open,
  onClose,
  modules,
}: {
  open: boolean;
  onClose: () => void;
  modules: ReturnType<typeof useResumeStore.getState>['modules'];
}) {
  const addSnapshot = useResumeSnapshotsStore((s) => s.addSnapshot);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 打开时默认全选
  useResetOnOpen(open, () => {
    setName('');
    setSelected(new Set(modules.map((m) => m.id)));
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    if (!name.trim()) {
      alert('请填写快照名称');
      return;
    }
    const picked = modules.filter((m) => selected.has(m.id));
    if (picked.length === 0) {
      alert('请至少选择一个模块');
      return;
    }
    try {
      addSnapshot(
        name.trim(),
        [...new Set(picked.flatMap((m) => m.tags ?? []))],
        picked.map((m) => ({ module_type: m.module_type, order: 0, content: JSON.parse(JSON.stringify(m.data)) })),
      );
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '创建失败');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="新建简历快照">
      <div className="p-5 space-y-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="快照名称，如：后端开发版"
          className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="max-h-64 overflow-y-auto space-y-1">
          {modules.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-container-low cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggle(m.id)}
                className="rounded border-line text-ink focus:ring-primary/30"
              />
              <span className="text-xs bg-surface-container text-ink px-2 py-0.5 rounded-full shrink-0">
                {MODULE_TYPE_LABELS[m.module_type]}
              </span>
              <span className="text-sm text-on-surface truncate">{moduleSummary(m)}</span>
            </label>
          ))}
        </div>
        <button
          onClick={submit}
          className="w-full bg-primary text-on-primary font-semibold py-2.5 rounded-xl text-sm"
        >
          创建快照
        </button>
      </div>
    </Modal>
  );
}

function moduleSummary(m: { module_type: keyof typeof MODULE_TYPE_LABELS; data: Record<string, unknown> }): string {
  const d = m.data;
  switch (m.module_type) {
    case 'experience':
      return [d.org, d.role].filter(Boolean).join(' · ');
    case 'education':
      return [d.school, d.degree].filter(Boolean).join(' · ');
    case 'skill':
      return d.category ? String(d.category) : '';
    case 'award':
      return d.name ? String(d.name) : '';
    case 'summary':
      return String(d.content ?? '').slice(0, 40);
    case 'basic_info':
      return d.name ? String(d.name) : '基本信息';
    default:
      return '';
  }
}
