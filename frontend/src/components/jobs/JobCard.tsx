import { Link } from 'react-router-dom';
import type { JobSummary } from '../../types/job';
import { useSavedJobs } from '../../hooks/useSavedJobs';
import { MatchBadge } from '../common/MatchBadge';
import { Icon } from '../common/Icon';
import { FreshPill } from './FreshPill';
import { getFreshness } from '../../lib/freshness';

interface JobCardProps {
  job: JobSummary;
  matchScore?: number | null;
  /**
   * 列表是否已按发布时间排序。
   * 已按时间排序时，首屏全是新岗位 —— 再给每条挂一个「刚发布」，
   * 重复的是排序已经说过的话，信号就退化成装饰了。
   */
  sortedByDate?: boolean;
}

/**
 * 两行卡片。公司提到与城市同级的上位（扫岗时先看「哪家公司」），
 * 元信息靠图标和留白分隔，右边一列等宽日期可以竖着比新旧。
 */
export function JobCard({ job, matchScore, sortedByDate = false }: JobCardProps) {
  const { isSaved, toggleSave } = useSavedJobs();
  const saved = isSaved(job.id);
  const fresh = getFreshness(job.publish_time);

  return (
    <div className="group relative rounded-xl border border-line bg-surface p-3 transition-colors hover:border-outline">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 truncate text-title font-medium text-ink">
          {job.title ?? '未命名职位'}
        </h3>
        {fresh.isFresh && !sortedByDate && (
          <FreshPill label={fresh.label} variant={fresh.days === 0 ? 'solid' : 'quiet'} />
        )}
        {matchScore != null && matchScore > 0 && <MatchBadge score={matchScore} />}
        <button
          type="button"
          onClick={() => toggleSave(job)}
          className={`relative z-10 -mr-1 -mt-1 shrink-0 rounded-md p-1 transition-colors ${
            saved ? 'text-signal-dim' : 'text-line hover:text-ink'
          }`}
          aria-label={saved ? '取消收藏' : '收藏'}
          title={saved ? '取消收藏' : '收藏'}
        >
          <Icon name={saved ? 'bookmark' : 'bookmark_border'} size={16} />
        </button>
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-meta">
        <span className="max-w-[10rem] shrink-0 truncate font-medium text-ink/75">
          {job.company ?? '未知公司'}
        </span>
        {job.work_city ? (
          <span className="flex shrink-0 items-center gap-0.5 text-muted">
            <Icon name="pin" size={13} />
            {job.work_city}
          </span>
        ) : (
          <span className="shrink-0 text-muted/70">城市未提供</span>
        )}
        {job.recruit_type && (
          <span className="shrink-0 rounded-sm bg-surface-container px-1.5 text-micro leading-[17px] text-muted">
            {job.recruit_type}
          </span>
        )}
        {job.job_category && (
          <span className="hidden min-w-0 truncate text-muted sm:block">{job.job_category}</span>
        )}
        <span className="num ml-auto shrink-0 text-muted" title={fresh.exact || undefined}>
          {fresh.short}
        </span>
      </div>

      {/* 整卡可点：比「查看详情」这类小链接的命中面积大得多 */}
      <Link
        to={`/jobs/${job.id}`}
        className="absolute inset-0 rounded-xl"
        aria-label={`查看 ${job.title ?? '职位'} 详情`}
      />
    </div>
  );
}
