import { describe, it, expect, beforeEach } from 'vitest';
import { useSavedJobsStore } from '../src/stores/savedJobsStore';
import type { JobSummary } from '../src/types/job';

function job(id: number, company = 'X'): JobSummary {
  return { id, job_id: `j${id}`, company, title: null, recruit_type: null, job_category: null, work_city: null, publish_time: null, detail_url: null };
}

beforeEach(() => {
  localStorage.clear();
  useSavedJobsStore.setState({ saved: [] });
});

describe('savedJobsStore', () => {
  it('toggle 添加并置顶', () => {
    const s = useSavedJobsStore.getState();
    s.toggleSave(job(1));
    s.toggleSave(job(2));
    expect(useSavedJobsStore.getState().saved.map((j) => j.id)).toEqual([2, 1]);
  });

  it('toggle 重复添加去重（String 比较）', () => {
    const s = useSavedJobsStore.getState();
    s.toggleSave(job(1));
    s.toggleSave({ ...job(1), company: 'Y' }); // 同 id 不同内容 → 移除
    expect(useSavedJobsStore.getState().saved).toHaveLength(0);
  });

  it('isSaved 用 String(id) 比较', () => {
    const s = useSavedJobsStore.getState();
    s.toggleSave(job(7));
    expect(s.isSaved(7)).toBe(true);
    expect(s.isSaved('7')).toBe(true);
    expect(s.isSaved(8)).toBe(false);
  });

  it('remove 删除并持久化', () => {
    const s = useSavedJobsStore.getState();
    s.toggleSave(job(1));
    s.toggleSave(job(2));
    s.remove(1);
    expect(useSavedJobsStore.getState().saved.map((j) => j.id)).toEqual([2]);
    const persisted = JSON.parse(localStorage.getItem('yesjob_saved_jobs')!);
    expect(persisted).toHaveLength(1);
  });
});
