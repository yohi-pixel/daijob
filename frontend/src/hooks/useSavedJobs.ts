import { useCallback } from 'react';
import { useSavedJobsStore } from '../stores/savedJobsStore';
import type { JobSummary } from '../types/job';

/** 收藏薄封装：isSaved/toggle/remove，供 JobCard、详情页、地图卡共用 */
export function useSavedJobs() {
  const saved = useSavedJobsStore((s) => s.saved);
  const isSaved = useSavedJobsStore((s) => s.isSaved);
  const toggleSave = useSavedJobsStore((s) => s.toggleSave);
  const remove = useSavedJobsStore((s) => s.remove);

  const toggleJob = useCallback(
    (job: JobSummary) => {
      toggleSave(job);
    },
    [toggleSave],
  );

  return { saved, isSaved, toggleSave: toggleJob, remove };
}
