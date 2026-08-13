import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../common/Modal';
import { Spinner } from '../common/Spinner';
import { useSSE } from '../../hooks/useSSE';
import { SSE_ENDPOINTS } from '../../services/aiApi';
import { getJobs } from '../../services/jobsApi';
import type { ModuleType, SerializedModuleData } from '../../types/resume';

interface AIModalProps {
  open: boolean;
  moduleType: ModuleType;
  moduleData: SerializedModuleData;
  onClose: () => void;
  onApply: (optimizedData: SerializedModuleData) => void;
}

/**
 * 模块级 AI 优化：原文 vs 可编辑结果对开，SSE 流式。
 */
export function AIModal({ open, moduleType, moduleData, onClose, onApply }: AIModalProps) {
  const [jobId, setJobId] = useState<number | ''>('');
  const [result, setResult] = useState('');

  const { data: jobs } = useQuery({
    queryKey: ['ai-job-select'],
    queryFn: () => getJobs({ page: 1, page_size: 100 }),
    enabled: open,
  });

  const { status, error, start, abort } = useSSE({
    url: SSE_ENDPOINTS.optimizeModule,
    onContent: (delta) => setResult((r) => r + delta),
  });

  useEffect(() => {
    if (open) {
      setResult('');
      setJobId('');
    }
  }, [open]);

  useEffect(() => () => abort(), [abort]);

  if (!open) return null;

  const runOptimize = () => {
    setResult('');
    start({
      module_type: moduleType,
      module_data: moduleData,
      job_id: jobId === '' ? null : Number(jobId),
    });
  };

  const parseResult = (): SerializedModuleData | null => {
    try {
      const cleaned = result.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const obj = JSON.parse(cleaned);
      if (typeof obj === 'object' && obj !== null) return obj as SerializedModuleData;
      return null;
    } catch {
      return null;
    }
  };

  const apply = () => {
    const parsed = parseResult();
    if (!parsed) {
      alert('AI 返回内容不是合法 JSON，请检查后手动复制');
      return;
    }
    onApply(parsed);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="AI 优化模块" maxWidth="max-w-3xl">
      <div className="p-5 space-y-4">
        {/* 目标 JD 选择 */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-on-surface-variant shrink-0">目标岗位（可选）</label>
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value === '' ? '' : Number(e.target.value))}
            className="flex-1 rounded-lg border border-outline-variant px-3 py-2 text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">不指定（通用优化）</option>
            {jobs?.items.slice(0, 50).map((j) => (
              <option key={j.id} value={j.id}>
                {j.company} · {j.title}
              </option>
            ))}
          </select>
          <button
            onClick={runOptimize}
            disabled={status === 'streaming' || status === 'loading'}
            className="punch-gradient text-on-primary text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {status === 'streaming' || status === 'loading' ? '优化中…' : '开始优化'}
          </button>
        </div>

        {error && <p className="text-xs text-error bg-error-container/20 rounded-lg px-3 py-2">{error.message}</p>}

        <div className="grid md:grid-cols-2 gap-4">
          {/* 原文 */}
          <div>
            <p className="text-xs font-medium text-on-surface-variant mb-2">原文</p>
            <pre className="text-xs bg-surface-container-low rounded-xl p-3 whitespace-pre-wrap max-h-72 overflow-y-auto text-on-surface-variant">
              {JSON.stringify(moduleData, null, 2)}
            </pre>
          </div>
          {/* 优化结果 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-on-surface-variant">优化结果</p>
              {status === 'loading' || status === 'streaming' ? (
                <span className="text-[11px] text-primary flex items-center gap-1">
                  <Spinner /> 生成中…
                </span>
              ) : status === 'done' ? (
                <span className="text-[11px] text-primary">✓ 完成</span>
              ) : null}
            </div>
            <textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="点击「开始优化」生成结果，也可直接编辑"
              className="w-full text-xs bg-surface-container-low rounded-xl p-3 h-72 resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">
            取消
          </button>
          <button
            onClick={apply}
            disabled={!result}
            className="punch-gradient text-on-primary text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-40"
          >
            应用结果
          </button>
        </div>
      </div>
    </Modal>
  );
}
