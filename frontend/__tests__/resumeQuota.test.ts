import { describe, it, expect } from 'vitest';
import { checkQuota, getQuotaStatus } from '../src/lib/resumeQuota';
import type { ModuleType, ResumeModule, ResumeSnapshot } from '../src/types/resume';

function makeModule(type: ModuleType, id: string, deleted = false): ResumeModule {
  return {
    id,
    module_type: type,
    tags: [],
    is_deleted: deleted,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    source: 'manual',
    cloned_from: null,
    data: {},
  };
}

function counter(mods: ResumeModule[]) {
  return (t: ModuleType) => mods.filter((m) => m.module_type === t && !m.is_deleted).length;
}

describe('resumeQuota', () => {
  it('basic_info 只能 1 条', () => {
    // 0 条 → 允许
    expect(checkQuota('basic_info', counter([])).ok).toBe(true);
    // 1 条 → 拒绝
    const mods = [makeModule('basic_info', 'a')];
    const r = checkQuota('basic_info', counter(mods));
    expect(r.ok).toBe(false);
    expect(r.message).toContain('基本信息最多保存 1 条');
  });

  it('experience/education/award 合计 10', () => {
    const mods: ResumeModule[] = [];
    for (let i = 0; i < 10; i++) mods.push(makeModule('experience', `e${i}`));
    expect(checkQuota('experience', counter(mods)).ok).toBe(false);
    expect(checkQuota('education', counter(mods)).ok).toBe(false);
    expect(checkQuota('award', counter(mods)).ok).toBe(false);
  });

  it('experience 类别之间共享配额：9 个 experience 时 education 仍可加', () => {
    const mods: ResumeModule[] = [];
    for (let i = 0; i < 9; i++) mods.push(makeModule('experience', `e${i}`));
    expect(checkQuota('education', counter(mods)).ok).toBe(true);
  });

  it('summary 上限 5', () => {
    const mods = Array.from({ length: 5 }, (_, i) => makeModule('summary', `s${i}`));
    expect(checkQuota('summary', counter(mods)).ok).toBe(false);
  });

  it('skill 上限 1', () => {
    const mods = [makeModule('skill', 'sk')];
    expect(checkQuota('skill', counter(mods)).ok).toBe(false);
  });

  it('软删除后不占配额（全删后可再加）', () => {
    const mods = [makeModule('basic_info', 'a', true), makeModule('basic_info', 'b', true)];
    expect(checkQuota('basic_info', counter(mods)).ok).toBe(true);
  });

  it('getQuotaStatus 汇总正确', () => {
    const mods = [
      makeModule('basic_info', 'a'),
      makeModule('experience', 'e1'),
      makeModule('experience', 'e2'),
      makeModule('education', 'ed1'),
      makeModule('summary', 's1'),
      makeModule('skill', 'sk'),
      makeModule('experience', 'e3', true), // 软删不计数
    ];
    const snapshots: ResumeSnapshot[] = [];
    const status = getQuotaStatus(mods, snapshots);
    expect(status.basic_info).toEqual({ used: 1, max: 1 });
    expect(status.experience).toEqual({ used: 3, max: 10 });
    expect(status.summary).toEqual({ used: 1, max: 5 });
    expect(status.skill).toEqual({ used: 1, max: 1 });
    expect(status.snapshots).toEqual({ used: 0, max: 2 });
  });
});
