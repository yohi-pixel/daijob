import { useState } from 'react';
import type { ModuleType, SerializedModuleData } from '../../types/resume';
import { FORM_FIELDS } from '../../lib/formFields';

import { Icon } from '../common/Icon';
interface ModuleFormProps {
  type: ModuleType;
  initialData?: SerializedModuleData;
  initialTags?: string[];
  onSubmit: (data: SerializedModuleData, tags: string[]) => void;
  onCancel: () => void;
}

/** 动态表单：由 FORM_FIELDS 配置驱动，含标签输入 */
export function ModuleForm({ type, initialData = {}, initialTags = [], onSubmit, onCancel }: ModuleFormProps) {
  const [form, setForm] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    FORM_FIELDS[type].forEach((f) => {
      const v = initialData[f.key];
      if (f.isArray) init[f.key] = Array.isArray(v) ? v.join(f.sep ?? '\n') : '';
      else if (v !== undefined && v !== null) init[f.key] = v;
      else init[f.key] = f.type === 'checkbox' ? false : '';
    });
    return init;
  });
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState('');

  const setField = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const addTag = (t: string) => {
    const v = t.trim();
    if (v && !tags.includes(v)) setTags((prev) => [...prev, v]);
    setTagInput('');
  };

  const submit = () => {
    // 校验必填
    for (const f of FORM_FIELDS[type]) {
      if (!f.required) continue;
      const v = form[f.key];
      if (f.type === 'checkbox') continue;
      if (v === '' || v === undefined || v === null) {
        alert(`请填写「${f.label}」`);
        return;
      }
    }
    const data: SerializedModuleData = {};
    FORM_FIELDS[type].forEach((f) => {
      let v = form[f.key];
      if (f.type === 'checkbox') {
        data[f.key] = Boolean(v);
      } else if (f.type === 'number') {
        data[f.key] = v === '' || v === undefined ? undefined : Number(v);
      } else if (f.isArray) {
        const raw = String(v ?? '').trim();
        data[f.key] = raw
          ? String(raw)
              .split(f.sep ?? '\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      } else {
        data[f.key] = String(v ?? '').trim();
      }
    });
    onSubmit(data, tags);
  };

  const inputCls =
    'w-full px-3 py-2 rounded-xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

  return (
    <div className="bg-surface rounded-2xl border border-line p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-on-surface">编辑模块</h3>
        <button onClick={onCancel} className="text-xs text-on-surface-variant hover:text-error">
          取消
        </button>
      </div>

      {FORM_FIELDS[type].map((f) => {
        const req = f.required ? <span className="text-error ml-0.5">*</span> : null;
        const val = form[f.key];
        if (f.type === 'textarea') {
          return (
            <div key={f.key}>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">
                {f.label}
                {req}
              </label>
              <textarea
                rows={f.rows ?? 3}
                value={String(val ?? '')}
                onChange={(e) => setField(f.key, e.target.value)}
                className={inputCls}
                placeholder={f.placeholder}
              />
            </div>
          );
        }
        if (f.type === 'select') {
          return (
            <div key={f.key}>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">
                {f.label}
                {req}
              </label>
              <select value={String(val ?? '')} onChange={(e) => setField(f.key, e.target.value)} className={inputCls}>
                {f.options?.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        if (f.type === 'checkbox') {
          return (
            <div key={f.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(val)}
                onChange={(e) => setField(f.key, e.target.checked)}
                className="rounded border-line text-ink focus:ring-primary/30"
              />
              <label className="text-sm text-on-surface-variant">{f.label}</label>
            </div>
          );
        }
        return (
          <div key={f.key}>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">
              {f.label}
              {req}
            </label>
            <input
              type={f.type}
              value={String(val ?? '')}
              onChange={(e) => setField(f.key, e.target.value)}
              className={inputCls}
              placeholder={f.placeholder}
            />
          </div>
        );
      })}

      {/* 标签输入 */}
      <div>
        <label className="block text-xs font-medium text-on-surface-variant mb-1">标签</label>
        <div className="flex flex-wrap gap-1.5 items-center">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 text-xs bg-surface-container text-ink px-2.5 py-1 rounded-full">
              {t}
              <button onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-error">
                <Icon name='close' size={13} />
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag(tagInput);
              }
            }}
            onBlur={() => addTag(tagInput)}
            placeholder={tags.length === 0 ? '输入标签后回车' : ''}
            className="flex-1 min-w-[120px] px-2 py-1 text-sm border-b border-line bg-transparent focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <button
        onClick={submit}
        className="w-full bg-primary text-on-primary font-semibold py-2.5 rounded-xl text-sm"
      >
        保存模块
      </button>
    </div>
  );
}
