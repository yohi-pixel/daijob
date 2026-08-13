import { Link } from 'react-router-dom';
import { useSavedJobs } from '../hooks/useSavedJobs';
import { EmptyState } from '../components/common/EmptyState';

export function SavedPage() {
  const { saved, remove } = useSavedJobs();

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-on-surface mb-4">我的收藏</h1>

      {saved.length === 0 ? (
        <EmptyState
          icon="bookmark_border"
          title="还没有收藏的职位"
          description="在职位列表点击收藏按钮，会出现在这里"
        />
      ) : (
        <div className="space-y-3">
          {saved.map((job) => (
            <div
              key={job.id}
              className="bg-surface rounded-2xl border border-outline-variant/20 p-4 flex items-center gap-4 hover:border-primary/30 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <Link to={`/jobs/${job.id}`} className="font-semibold text-on-surface hover:text-primary transition-colors block truncate">
                  {job.title ?? '未命名职位'}
                </Link>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  {job.company}
                  {job.work_city && (
                    <>
                      <span className="mx-1.5 text-outline-variant">•</span>
                      {job.work_city}
                    </>
                  )}
                </p>
                {job.job_category && (
                  <span className="inline-block text-xs bg-surface-container-low px-2 py-0.5 rounded-full text-on-surface-variant mt-1.5">
                    {job.job_category}
                  </span>
                )}
              </div>
              <button
                onClick={() => remove(job.id)}
                className="shrink-0 text-sm text-on-surface-variant hover:text-error transition-colors px-2 py-1"
              >
                移除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
