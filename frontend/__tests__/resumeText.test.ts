import { describe, it, expect } from 'vitest';
import { buildResumeContext, assembleResumeText } from '../src/lib/resumeText';
import type { ResumeModule } from '../src/types/resume';

function mod(partial: Partial<ResumeModule> & { module_type: ResumeModule['module_type'] }): ResumeModule {
  return {
    id: partial.id ?? 'm1',
    module_type: partial.module_type,
    tags: partial.tags ?? [],
    is_deleted: partial.is_deleted ?? false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    source: 'manual',
    cloned_from: null,
    data: partial.data ?? {},
  };
}

describe('buildResumeContext', () => {
  it('各类型模块拼接格式正确', () => {
    const modules = [
      mod({ module_type: 'basic_info', data: { name: '张三', phone: '138', email: 'a@b.com' } }),
      mod({ module_type: 'education', data: { school: 'X大学', degree: '本科', major: '计算机' } }),
      mod({ module_type: 'experience', data: { org: '某公司', role: '后端', description: '做了事' } }),
      mod({ module_type: 'skill', data: { category: '编程', items: ['Python', 'Go'] } }),
    ];
    const ctx = buildResumeContext(modules);
    expect(ctx).toContain('基本信息：张三 138 a@b.com');
    expect(ctx).toContain('教育经历：X大学 本科 计算机');
    expect(ctx).toContain('工作经历：某公司 后端');
    expect(ctx).toContain('技能：编程 Python、Go');
  });

  it('空模块库返回空串', () => {
    expect(buildResumeContext([])).toBe('');
  });

  it('软删模块不进入上下文', () => {
    const modules = [
      mod({ module_type: 'summary', data: { content: '可见' } }),
      mod({ module_type: 'summary', data: { content: '不可见' }, is_deleted: true }),
    ];
    const ctx = buildResumeContext(modules);
    expect(ctx).toContain('可见');
    expect(ctx).not.toContain('不可见');
  });

  it('assembleResumeText 输出可读文本', () => {
    const modules = [mod({ module_type: 'basic_info', data: { name: '李四' } })];
    expect(assembleResumeText(modules)).toContain('基本信息: 李四');
  });
});
