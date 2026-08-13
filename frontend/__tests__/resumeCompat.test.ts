import { describe, it, expect } from 'vitest';
import { normalizeResumeModule, normalizeSnapshot, parseResumeModulesLS, OLD_TYPE_MAP } from '../src/lib/resumeCompat';

describe('resumeCompat', () => {
  it('旧 schema {type: basic} → module_type basic_info', () => {
    const m = normalizeResumeModule({ type: 'basic', data: { name: '张三' } });
    expect(m).not.toBeNull();
    expect(m!.module_type).toBe('basic_info');
    expect(m!.data.name).toBe('张三');
  });

  it('project 映射到 experience', () => {
    const m = normalizeResumeModule({ type: 'project', data: { name: '项目A' } });
    expect(m!.module_type).toBe('experience');
  });

  it('新 schema module_type 直通', () => {
    const m = normalizeResumeModule({ module_type: 'summary', data: { content: 'hi' } });
    expect(m!.module_type).toBe('summary');
    expect(m!.data.content).toBe('hi');
  });

  it('未知 type 丢弃', () => {
    expect(normalizeResumeModule({ type: 'unknown_type' })).toBeNull();
    expect(normalizeResumeModule(null)).toBeNull();
    expect(normalizeResumeModule('string')).toBeNull();
  });

  it('缺字段补默认', () => {
    const m = normalizeResumeModule({ type: 'skill' });
    expect(m!.tags).toEqual([]);
    expect(m!.is_deleted).toBe(false);
    expect(m!.source).toBe('manual');
    expect(m!.cloned_from).toBeNull();
    expect(m!.data).toEqual({});
    expect(typeof m!.created_at).toBe('string');
  });

  it('is_deleted 保留', () => {
    const m = normalizeResumeModule({ type: 'experience', is_deleted: true });
    expect(m!.is_deleted).toBe(true);
  });

  it('OLD_TYPE_MAP 覆盖全部旧命名', () => {
    expect(Object.keys(OLD_TYPE_MAP).sort()).toEqual(['basic', 'education', 'experience', 'project', 'skill', 'summary']);
  });

  it('parseResumeModulesLS 过滤软删与非法条目', () => {
    const raw = JSON.stringify([
      { type: 'basic', data: { name: 'A' } },
      { module_type: 'skill', data: {} },
      { type: 'experience', is_deleted: true },
      { type: 'nonsense' },
      'garbage',
    ]);
    const mods = parseResumeModulesLS(raw);
    expect(mods).toHaveLength(2);
    expect(mods.map((m) => m.module_type).sort()).toEqual(['basic_info', 'skill']);
  });

  it('parseResumeModulesLS 空/非法输入', () => {
    expect(parseResumeModulesLS(null)).toEqual([]);
    expect(parseResumeModulesLS('not json')).toEqual([]);
    expect(parseResumeModulesLS('{}')).toEqual([]);
  });

  it('normalizeSnapshot 缺 order 自动补齐', () => {
    const snap = normalizeSnapshot({
      id: 's1',
      name: '快照',
      target_tags: ['后端'],
      sections: [
        { type: 'basic', data: { name: 'A' } },
        { module_type: 'experience', data: { org: 'X' }, order: 5 },
      ],
    });
    expect(snap).not.toBeNull();
    expect(snap!.sections).toHaveLength(2);
    expect(snap!.sections[0].order).toBe(0);
    expect(snap!.sections[0].module_type).toBe('basic_info');
    expect(snap!.sections[1].order).toBe(5);
    expect(snap!.sections[1].content.org).toBe('X');
  });
});
