import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { SearchHero } from '../components/jobs/SearchHero';
import { JobFilterSidebar, type FilterState } from '../components/jobs/JobFilterSidebar';
import { JobCard } from '../components/jobs/JobCard';
import { Pagination } from '../components/common/Pagination';
import { Spinner } from '../components/common/Spinner';
import { EmptyState, ErrorState } from '../components/common/EmptyState';
import { getJobs, matchJobs } from '../services/jobsApi';
import { useAuthStore } from '../stores/authStore';
import { STORAGE_KEYS } from '../lib/storage';
import { assembleResumeText } from '../lib/resumeText';
import { readResumeModules } from '../lib/resumeCompat';
import { useDebounce } from '../hooks/useDebounce';

const PAGE_SIZE = 10;

const EMPTY_FILTERS: FilterState = { city: [], recruit_type: [], job_category: [], company: [] };

export function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const keyword = searchParams.get('q') ?? '';

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const debouncedQ = useDebounce(keyword, 300);

  const token = useAuthStore((s) => s.token);

  // 拼 TanStack Query 参数
  const params = useMemo(
    () => ({
      q: debouncedQ || undefined,
      city: filters.city.length ? filters.city.join(',') : undefined,
      recruit_type: filters.recruit_type.length ? filters.recruit_type.join(',') : undefined,
      job_category: filters.job_category.length ? filters.job_category.join(',') : undefined,
      company: filters.company.length ? filters.company.join(',') : undefined,
      sort: debouncedQ ? 'relevance' as const : 'latest' as const,
      page,
      page_size: PAGE_SIZE,
    }),
    [debouncedQ, filters, page],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['jobs', params],
    queryFn: () => getJobs(params),
    placeholderData: (prev) => prev,
  });

  // 简历打分（登录且有简历文本时）
  const [matchScores, setMatchScores] = useState<Record<string, number | null>>({});
  useEffect(() => {
    if (!token || !data?.items.length) {
      setMatchScores({});
      return;
    }
    const storedText = localStorage.getItem(STORAGE_KEYS.resumeText);
    const resumeText = storedText || assembleResumeText(readResumeModules());
    if (!resumeText) {
      setMatchScores({});
      return;
    }
    let cancelled = false;
    matchJobs(resumeText, data.items.slice(0, 50).map((j) => j.id))
      .then((res) => {
        if (!cancelled) setMatchScores(res.scores);
      })
      .catch(() => {
        if (!cancelled) setMatchScores({});
      });
    return () => {
      cancelled = true;
    };
  }, [token, data]);

  const handleSearch = (q: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (q) next.set('q', q);
      else next.delete('q');
      next.delete('page');
      return next;
    });
  };

  const handleFiltersChange = (next: FilterState) => {
    setFilters(next);
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      sp.delete('page');
      return sp;
    });
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setSearchParams({});
  };

  const handlePageChange = (p: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <SearchHero keyword={keyword} onSearch={handleSearch} />

      <div className="max-w-7xl mx-auto px-4 mt-4 flex flex-col md:flex-row gap-6">
        {/* 侧栏筛选（移动端折叠在顶部） */}
        <aside className="md:w-60 shrink-0 md:sticky md:top-20 self-start w-full md:max-h-[calc(100vh-6rem)] md:overflow-y-auto">
          <div className="md:hidden mb-2 text-xs text-on-surface-variant font-medium">筛选条件</div>
          <JobFilterSidebar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onReset={handleReset}
            params={params}
          />
        </aside>

        {/* 列表 */}
        <section className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-sm text-on-surface-variant">
              {data ? `共 ${data.total} 个职位` : ''}
            </span>
            {keyword && (
              <span className="text-xs text-on-surface-variant">
                关键词「{keyword}」{debouncedQ !== keyword ? '（输入中…）' : ''}
              </span>
            )}
          </div>

          {isLoading && <Spinner />}
          {isError && <ErrorState message={error instanceof Error ? error.message : '加载失败'} onRetry={() => refetch()} />}
          {data && data.items.length === 0 && !isLoading && (
            <EmptyState title="没有找到匹配的职位" description="试试调整筛选条件或更换关键词" />
          )}
          {data && data.items.length > 0 && (
            <div className="space-y-3">
              {data.items.map((job) => (
                <JobCard key={job.id} job={job} matchScore={matchScores[String(job.id)]} />
              ))}
            </div>
          )}

          {data && data.total > PAGE_SIZE && (
            <Pagination total={data.total} page={page} pageSize={PAGE_SIZE} onPageChange={handlePageChange} />
          )}
        </section>
      </div>
    </div>
  );
}
