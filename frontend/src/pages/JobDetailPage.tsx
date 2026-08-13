import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { getJobDetail } from '../services/jobsApi';
import { useSavedJobs } from '../hooks/useSavedJobs';
import { Spinner } from '../components/common/Spinner';
import { ErrorState } from '../components/common/EmptyState';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['job', id],
    queryFn: () => getJobDetail(id!),
    enabled: !!id,
  });

  const { isSaved, toggleSave } = useSavedJobs();

  if (isLoading) return <Spinner size="lg" />;
  if (isError) return <ErrorState message={error instanceof Error ? error.message : '加载失败'} onRetry={() => refetch()} />;
  if (!data) return <ErrorState message="职位不存在" />;

  const saved = isSaved(data.id);

  const sections: Array<{ key: string; title: string; content: string | null }> = [
    { key: 'team', title: '团队介绍', content: data.team_intro },
    { key: 'resp', title: '职位职责', content: data.responsibilities },
    { key: 'req', title: '职位要求', content: data.requirements },
    { key: 'bonus', title: '加分项', content: data.bonus_points },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link to="/jobs" className="text-sm text-on-surface-variant hover:text-primary inline-flex items-center gap-1 mb-4">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        返回职位列表
      </Link>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 主内容 */}
        <div className="flex-1 min-w-0 space-y-5">
          <div className="bg-surface rounded-2xl border border-outline-variant/20 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-on-surface">{data.title ?? '未命名职位'}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-on-surface-variant">
                  <span>{data.company}</span>
                  {data.work_city && (
                    <>
                      <span className="text-outline-variant">•</span>
                      <span>{data.work_city}</span>
                    </>
                  )}
                  {data.recruit_type && (
                    <>
                      <span className="text-outline-variant">•</span>
                      <span>{data.recruit_type}</span>
                    </>
                  )}
                  {data.job_category && (
                    <>
                      <span className="text-outline-variant">•</span>
                      <span>{data.job_category}</span>
                    </>
                  )}
                </div>
                {data.tags && data.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {data.tags.map((t, i) => (
                      <span key={i} className="text-xs bg-surface-container-low px-2.5 py-1 rounded-full text-on-surface-variant">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => toggleSave(data)}
                className={`shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  saved ? 'text-primary bg-primary-container/20' : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">{saved ? 'bookmark' : 'bookmark_border'}</span>
                {saved ? '已收藏' : '收藏'}
              </button>
            </div>
          </div>

          {sections
            .filter((s) => s.content)
            .map((s) => (
              <div key={s.key} className="bg-surface rounded-2xl border border-outline-variant/20 p-6">
                <h2 className="font-semibold text-on-surface mb-3">{s.title}</h2>
                <div className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{s.content}</div>
              </div>
            ))}
        </div>

        {/* 侧栏 */}
        <aside className="lg:w-72 shrink-0 space-y-4 lg:sticky lg:top-20 self-start">
          <div className="bg-surface rounded-2xl border border-outline-variant/20 p-5 space-y-4">
            <h3 className="font-semibold text-sm text-on-surface">职位信息</h3>
            <dl className="space-y-2.5 text-sm">
              {data.job_function && (
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">职能</dt>
                  <dd className="text-on-surface">{data.job_function}</dd>
                </div>
              )}
              {data.work_cities && data.work_cities.length > 0 && (
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">工作城市</dt>
                  <dd className="text-on-surface">{data.work_cities.join(' / ')}</dd>
                </div>
              )}
              {data.publish_time && (
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">发布日期</dt>
                  <dd className="text-on-surface">{new Date(data.publish_time).toLocaleDateString('zh-CN')}</dd>
                </div>
              )}
            </dl>
            {data.detail_url && (
              <a
                href={data.detail_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block text-center punch-gradient text-on-primary font-semibold py-3 rounded-xl text-sm"
              >
                前往投递
              </a>
            )}
            <Link
              to="/resume"
              className="w-full block text-center text-sm font-medium text-primary border border-primary/40 py-3 rounded-xl hover:bg-primary-container/10 transition-colors"
            >
              用 AI 优化简历
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
