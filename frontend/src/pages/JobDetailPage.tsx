import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { getJobDetail } from '../services/jobsApi';
import { useSavedJobs } from '../hooks/useSavedJobs';
import { Spinner } from '../components/common/Spinner';
import { ErrorState } from '../components/common/EmptyState';
import { Icon } from '../components/common/Icon';
import { FreshPill } from '../components/jobs/FreshPill';
import { getFreshness } from '../lib/freshness';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['job', id],
    queryFn: () => getJobDetail(id!),
    enabled: !!id,
  });

  const { isSaved, toggleSave } = useSavedJobs();

  if (isLoading) return <Spinner size="lg" />;
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : '没能取到这个职位'}
        onRetry={() => refetch()}
      />
    );
  }
  if (!data) return <ErrorState message="这个职位可能已经下架" />;

  const saved = isSaved(data.id);
  const fresh = getFreshness(data.publish_time);

  const sections: Array<{ key: string; title: string; content: string | null }> = [
    { key: 'team', title: '团队介绍', content: data.team_intro },
    { key: 'resp', title: '职位职责', content: data.responsibilities },
    { key: 'req', title: '职位要求', content: data.requirements },
    { key: 'bonus', title: '加分项', content: data.bonus_points },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
      <Link
        to="/jobs"
        className="mb-4 inline-flex items-center gap-1.5 text-meta text-muted transition-colors hover:text-ink"
      >
        <Icon name="arrow_back" size={16} />
        返回职位列表
      </Link>

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* 主内容 */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-h1 font-medium leading-tight text-ink">
                  {data.title ?? '未命名职位'}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-body text-muted">
                  <span className="font-medium text-ink/80">{data.company ?? '未知公司'}</span>
                  {data.work_city ? (
                    <span className="flex items-center gap-0.5 text-meta">
                      <Icon name="pin" size={14} />
                      {data.work_city}
                    </span>
                  ) : (
                    <span className="text-meta text-muted/70">城市未提供</span>
                  )}
                  {data.recruit_type && (
                    <span className="rounded-sm bg-surface-container px-1.5 text-meta leading-[19px]">
                      {data.recruit_type}
                    </span>
                  )}
                  {data.job_category && <span className="text-meta">{data.job_category}</span>}
                  {fresh.isFresh ? (
                    <FreshPill label={fresh.label} variant={fresh.days === 0 ? 'solid' : 'quiet'} />
                  ) : (
                    <span className="num text-meta" title={fresh.exact || undefined}>
                      {fresh.exact || '时间未知'}
                    </span>
                  )}
                </div>

                {data.tags && data.tags.length > 0 && (
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    {data.tags.map((t, i) => (
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

              <button
                type="button"
                onClick={() => toggleSave(data)}
                className={`flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-meta font-medium transition-colors ${
                  saved
                    ? 'border-signal-dim bg-signal-soft text-signal-ink'
                    : 'border-line text-ink hover:border-ink'
                }`}
                aria-pressed={saved}
              >
                <Icon name={saved ? 'bookmark' : 'bookmark_border'} size={16} />
                {saved ? '已收藏' : '收藏'}
              </button>
            </div>
          </div>

          {sections
            .filter((s) => s.content || ['resp', 'req'].includes(s.key))
            .map((s) => (
              <section key={s.key} className="rounded-xl border border-line bg-surface p-5 sm:p-6">
                <h2 className="text-lead font-medium text-ink">{s.title}</h2>
                {s.content ? (
                  <div className="mt-2.5 whitespace-pre-wrap text-body leading-relaxed text-ink/85">
                    {s.content}
                  </div>
                ) : (
                  <p className="mt-2 text-body text-muted">
                    这家公司没有在这条职位里写这一项，投递前可以在官方页面确认
                  </p>
                )}
              </section>
            ))}
        </div>

        {/* 侧栏 */}
        <aside className="shrink-0 space-y-4 self-start lg:sticky lg:top-[4.5rem] lg:w-72">
          <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
            <h2 className="text-meta text-muted">职位信息</h2>
            <dl className="space-y-2.5 text-body">
              {data.job_function && (
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-muted">职能</dt>
                  <dd className="min-w-0 text-right text-ink">{data.job_function}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-muted">工作城市</dt>
                <dd className="min-w-0 text-right text-ink">
                  {data.work_cities && data.work_cities.length > 0 ? (
                    data.work_cities.join(' / ')
                  ) : data.work_city ? (
                    data.work_city
                  ) : (
                    <span className="text-muted">未提供</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-muted">发布日期</dt>
                <dd className={`num min-w-0 text-right ${fresh.exact ? 'text-ink' : 'text-muted'}`}>
                  {fresh.exact || '未提供'}
                </dd>
              </div>
            </dl>

            {data.detail_url ? (
              <a
                href={data.detail_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-body font-medium text-on-primary transition-colors hover:bg-secondary-dim"
              >
                去官网投递
                <Icon name="external" size={15} />
              </a>
            ) : (
              <p className="rounded-md bg-surface-container-low px-3 py-2.5 text-meta leading-relaxed text-muted">
                这条职位没有公开投递链接。可以到 {data.company} 招聘官网，用职位名搜索。
              </p>
            )}

            <Link
              to="/resume"
              className="block w-full rounded-md border border-ink/25 py-2.5 text-center text-body font-medium text-ink transition-colors hover:border-ink"
            >
              用 AI 优化简历
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
