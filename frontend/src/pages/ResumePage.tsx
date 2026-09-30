import { useState } from 'react';
import { useResumeStore } from '../stores/resumeStore';
import { ModuleTypeNav } from '../components/resume/ModuleTypeNav';
import { TagFilter } from '../components/resume/TagFilter';
import { ModuleForm } from '../components/resume/ModuleForm';
import { ModuleCard } from '../components/resume/ModuleCard';
import { SnapshotPanel } from '../components/resume/SnapshotPanel';
import { StorageUsageBar } from '../components/resume/StorageUsageBar';
import { AIModal } from '../components/resume/AIModal';
import { Modal } from '../components/common/Modal';
import { Icon } from '../components/common/Icon';
import { uploadResumeParse } from '../services/aiApi';
import { useAuthStore } from '../stores/authStore';
import type { ModuleType, SerializedModuleData } from '../types/resume';
import { MODULE_TYPE_LABELS } from '../types/resume';

export function ResumePage() {
  const store = useResumeStore();
  const modules = useResumeStore((s) => s.modules);
  const currentType = useResumeStore((s) => s.currentType);
  const activeTag = useResumeStore((s) => s.activeTag);

  // 编辑状态
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiTarget, setAiTarget] = useState<{ id: string; type: ModuleType; data: SerializedModuleData } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // 列表（类型 + 标签筛选）
  const typeList = currentType === 'all' ? modules.filter((m) => !m.is_deleted) : modules.filter((m) => !m.is_deleted && m.module_type === currentType);
  const list = activeTag ? typeList.filter((m) => m.tags?.includes(activeTag)) : typeList;

  const startAdd = () => {
    setEditingId(null);
    setFormOpen(true);
  };

  const startEdit = (id: string) => {
    setEditingId(id);
    setFormOpen(true);
  };

  const handleSubmit = (data: SerializedModuleData, tags: string[]) => {
    try {
      if (editingId) {
        store.updateModule(editingId, { data, tags });
      } else {
        const type = currentType === 'all' ? 'experience' : currentType;
        store.addModule(type, data, tags);
      }
      setFormOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存失败');
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定删除该模块？')) store.deleteModule(id);
  };

  const initialData = editingId ? modules.find((m) => m.id === editingId)?.data : undefined;
  const initialTags = editingId ? modules.find((m) => m.id === editingId)?.tags ?? [] : undefined;
  const formType: ModuleType = editingId
    ? (modules.find((m) => m.id === editingId)?.module_type ?? 'experience')
    : currentType === 'all'
      ? 'experience'
      : currentType;

  const applyAI = (optimized: SerializedModuleData) => {
    if (!aiTarget) return;
    try {
      store.updateModule(aiTarget.id, { data: optimized });
    } catch (e) {
      alert(e instanceof Error ? e.message : '应用失败');
    }
    setAiTarget(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-medium text-ink">简历管理</h1>
          <p className="mt-1 text-meta text-muted">
            按模块写经历，AI 可以帮你改写成简历语言，再导出成 PDF / Word
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="rounded-md border border-line px-3.5 py-2 text-meta font-medium text-ink transition-colors hover:border-ink"
          >
            上传解析
          </button>
          <button
            type="button"
            onClick={startAdd}
            className="rounded-md bg-primary px-3.5 py-2 text-meta font-medium text-on-primary transition-colors hover:bg-secondary-dim"
          >
            新增模块
          </button>
        </div>
      </div>

      {/* 顶部：类型导航 + 标签筛选 + 用量 */}
      <div className="mb-6 space-y-3">
        <ModuleTypeNav />
        <TagFilter />
        <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
          <StorageUsageBar />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 中栏：表单 + 模块列表 */}
        <div className="lg:col-span-2 space-y-4">
          {formOpen && (
            <ModuleForm
              type={formType}
              initialData={initialData}
              initialTags={initialTags}
              onSubmit={handleSubmit}
              onCancel={() => setFormOpen(false)}
            />
          )}

          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-14 text-center">
              <Icon name="description" size={28} className="text-line" />
              <p className="mt-3 text-body text-ink">
                还没有{activeTag ? `「${activeTag}」标签下的` : ''}模块
              </p>
              <p className="mt-1 max-w-xs text-meta text-muted">
                先填一条经历，AI 能把它改写成简历上的写法
              </p>
              <button
                type="button"
                onClick={startAdd}
                className="mt-4 rounded-md bg-primary px-4 py-2 text-body font-medium text-on-primary transition-colors hover:bg-secondary-dim"
              >
                新增{currentType === 'all' ? '' : MODULE_TYPE_LABELS[currentType]}模块
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {list.map((m) => (
                <ModuleCard
                  key={m.id}
                  module={m}
                  onEdit={() => startEdit(m.id)}
                  onClone={() => {
                    try {
                      store.cloneModule(m.id);
                    } catch (e) {
                      alert(e instanceof Error ? e.message : '复制失败');
                    }
                  }}
                  onDelete={() => handleDelete(m.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 右栏：快照 */}
        <div className="lg:col-span-1">
          <SnapshotPanel />
        </div>
      </div>

      {/* AI 优化模态框 */}
      {aiTarget && (
        <AIModal
          open={!!aiTarget}
          moduleType={aiTarget.type}
          moduleData={aiTarget.data}
          onClose={() => setAiTarget(null)}
          onApply={applyAI}
        />
      )}

      {/* 上传解析 */}
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onParsed={(parsed) => {
          const mods = parsedToModules(parsed);
          mods.forEach((m) => {
            try {
              store.addModule(m.type, m.data, []);
            } catch {
              /* 配额满跳过 */
            }
          });
          setUploadOpen(false);
          alert(`成功导入 ${mods.length} 个模块`);
        }}
      />
    </div>
  );
}

// ── 上传解析 ────────────────────────────────────────────────────────────────
function UploadModal({
  open,
  onClose,
  onParsed,
}: {
  open: boolean;
  onClose: () => void;
  onParsed: (parsed: ParsedResume) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useAuthStore((s) => s.token);

  const doParse = async () => {
    if (!file) return;
    if (!token) {
      setError('请先登录');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = (await uploadResumeParse(file, false)) as unknown;
      onParsed(result as ParsedResume);
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="上传简历解析">
      <div className="p-5 space-y-4">
        <p className="text-xs text-on-surface-variant">
          支持 PDF / DOCX，解析后按模块导入简历库（Basic/教育/经历/技能/奖项）。
        </p>
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm"
        />
        {error && <p className="text-xs text-error bg-error-container/20 rounded-lg px-3 py-2">{error}</p>}
        <button
          onClick={doParse}
          disabled={!file || loading}
          className="w-full bg-primary text-on-primary font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
        >
          {loading ? '解析中…' : '开始解析'}
        </button>
      </div>
    </Modal>
  );
}

// ── 解析结果 → 模块 ─────────────────────────────────────────────────────────
interface ParsedResume {
  basic_info: Record<string, unknown> | null;
  experiences: Array<{ module_type: string; data: Record<string, unknown> }>;
  skill: { items?: string[] } | null;
  summary: { content?: string } | null;
}

function parsedToModules(parsed: ParsedResume): Array<{ type: ModuleType; data: SerializedModuleData }> {
  const out: Array<{ type: ModuleType; data: SerializedModuleData }> = [];
  if (parsed.basic_info) out.push({ type: 'basic_info', data: parsed.basic_info });
  (parsed.experiences ?? []).forEach((e) => {
    if (e.module_type === 'education') out.push({ type: 'education', data: e.data });
    else if (e.module_type === 'award') out.push({ type: 'award', data: e.data });
    else out.push({ type: 'experience', data: e.data });
  });
  if (parsed.skill?.items?.length) out.push({ type: 'skill', data: { category: '技能', items: parsed.skill.items } });
  if (parsed.summary?.content) out.push({ type: 'summary', data: { content: parsed.summary.content } });
  return out;
}
