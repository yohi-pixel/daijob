import type { JobDetail, JobSummary } from '../../types/job';
import { Icon } from '../common/Icon';
import { FreshPill } from '../jobs/FreshPill';
import { getFreshness } from '../../lib/freshness';

interface ExploreCardProps {
  job: JobSummary;
  /** 只有最上面那张拿详情，后面两张只是壳 */
  detail?: JobDetail;
  saved: boolean;
  onToggleSave: () => void;
}

/** 压成一句可读的摘要 —— 详情里的 JD 常带大量换行与空段 */
function summarize(text: string | null | undefined, max: number): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/**
 * 滑动探索卡。原先只有标题、公司、三个标签，然后 360px 全空 ——
 * 现在把职责、要求、标签、投递入口都摊在卡面上，滑一张就能判断值不值得点开。
 */
export function ExploreCard({ job, detail, saved, onToggleSave }: ExploreCardProps) {
  const fresh = getFreshness(job.publish_time);
  const responsibilities = summarize(detail?.responsibilities, 210);
  const requirements = summarize(detail?.requirements, 150);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <h2 className="min-w-0 flex-1 text-h2 font-medium leading-tight text-ink">
          {job.title ?? '未命名职位'}
        </h2>
        <button
          type="button"
          onClick={onToggleSave}
          className={`-mr-1 -mt-1 shrink-0 rounded-md p-1.5 transition-colors ${
            saved ? 'text-signal-dim' : 'text-line hover:text-ink'
          }`}
          aria-label={saved ? '取消收藏' : '收藏'}
        >
          <Icon name={saved ? 'bookmark' : 'bookmark_border'} size={20} />
        </button>
      </div>

      <p className="mt-1 text-lead text-ink/80">{job.company ?? '未知公司'}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-meta text-muted">
        {job.work_city ? (
          <span className="flex items-center gap-0.5">
            <Icon name="pin" size={14} />
            {job.work_city}
          </span>
        ) : (
          <span className="text-muted/70">城市未提供</span>
        )}
        {job.recruit_type && (
          <span className="rounded-sm bg-surface-container px-1.5 leading-[18px]">
            {job.recruit_type}
          </span>
        )}
        {job.job_category && <span>{job.job_category}</span>}
        {fresh.isFresh ? (
          <FreshPill label={fresh.label} variant={fresh.days === 0 ? 'solid' : 'quiet'} />
        ) : (
          <span className="num" title={fresh.exact || undefined}>
            {fresh.exact || '时间未知'}
          </span>
        )}
      </div>

      <div className="mt-4 flex-1 space-y-3.5 overflow-hidden border-t border-line pt-4">
        <section>
          <h3 className="text-micro text-muted">做什么</h3>
          <p className="mt-1 text-body leading-relaxed text-ink/85">
            {responsibilities || (
              <span className="text-muted">该岗位未提供职责描述，点开查看官方页面</span>
            )}
          </p>
        </section>

        {requirements && (
          <section>
            <h3 className="text-micro text-muted">要什么</h3>
            <p className="mt-1 text-body leading-relaxed text-ink/85">{requirements}</p>
          </section>
        )}

        {detail?.tags && detail.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {detail.tags.slice(0, 6).map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="rounded-sm border border-line px-1.5 py-px text-micro text-muted"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
