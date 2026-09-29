import { Link } from 'react-router-dom';
import type { JobSummary } from '../../types/job';
import { useSavedJobs } from '../../hooks/useSavedJobs';
import { MatchBadge } from '../common/MatchBadge';

interface JobCardProps {
  job: JobSummary;
  matchScore?: number | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function JobCard({ job, matchScore }: JobCardProps) {
  const { isSaved, toggleSave } = useSavedJobs();
  const saved = isSaved(job.id);

  return (
    <div className="group bg-surface rounded-2xl border border-outline-variant/20 p-4 hover:shadow-md hover:border-primary/30 transition-all">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/jobs/${job.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
              {job.title ?? '未命名职位'}
            </h3>
            {matchScore != null && matchScore > 0 && <MatchBadge score={matchScore} />}
          </div>
          <p className="text-sm text-on-surface-variant mt-1">
            {job.company ?? '未知公司'}
            <span className="mx-1.5 text-outline-variant">•</span>
            {job.work_city ? (
              job.work_city
            ) : (
              <span className="text-outline-variant italic">城市未提供</span>
            )}
            {job.recruit_type && <span className="mx-1.5 text-outline-variant">•</span>}
            {job.recruit_type}
          </p>
        </Link>
        <button
          onClick={() => toggleSave(job)}
          className={`shrink-0 p-2 rounded-lg transition-colors ${
            saved ? 'text-primary bg-primary-container/20' : 'text-outline-variant hover:text-primary hover:bg-primary-container/10'
          }`}
          title={saved ? '取消收藏' : '收藏'}
        >
          <span className="material-symbols-outlined text-[20px]">{saved ? 'bookmark' : 'bookmark_border'}</span>
        </button>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-on-surface-variant">
          {job.job_category ? (
            job.job_category
          ) : (
            <span className="text-outline-variant italic">类别未提供</span>
          )}
          {job.publish_time && (
            <>
              <span className="mx-1.5 text-outline-variant">•</span>
              {formatDate(job.publish_time)}
            </>
          )}
        </span>
        <Link
          to={`/jobs/${job.id}`}
          className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity"
        >
          查看详情 →
        </Link>
      </div>
    </div>
  );
}
