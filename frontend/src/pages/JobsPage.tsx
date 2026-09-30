import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { SearchBar } from '../components/jobs/SearchBar';
import { JobFilterBar } from '../components/jobs/JobFilterBar';
import { JobCard } from '../components/jobs/JobCard';
import { Pagination } from '../components/common/Pagination';
import { Spinner } from '../components/common/Spinner';
import { EmptyState, ErrorState } from '../components/common/EmptyState';
import { Icon } from '../components/common/Icon';
import { getJobs, matchJobs } from '../services/jobsApi';
import { useAuthStore } from '../stores/authStore';
import { STORAGE_KEYS } from '../lib/storage';
import { assembleResumeText } from '../lib/resumeText';
import { readResumeModules } from '../lib/resumeCompat';
import { useDebounce } from '../hooks/useDebounce';
import { EMPTY_FILTERS, toFilterChips } from '../lib/filterMeta';
import type { JobFilters } from '../types/job';

const PAGE_SIZE = 12;

const HOT_QUERIES = ['后端开发', '算法', '前端', '产品经理', '数据分析'];

type SortMode = 'latest' | 'relevance';

export function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const keyword = searchParams.get('q') ?? '';

  const [filters, setFilters] = useState<JobFilters>(EMPTY_FILTERS);
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const debouncedQ = useDebounce(keyword, 300);

  const token = useAuthStore((s) => s.token);

  // 有关键词时相关度才有意义，默认跟着切；用户手动改过则尊重用户
  useEffect(() => {
    setSortMode(debouncedQ ? 'relevance' : 'latest');
  }, [debouncedQ]);

  const params = useMemo(
    () => ({
      q: debouncedQ || undefined,
      city: filters.city.length ? filters.city.join(',') : undefined,
      recruit_type: filters.recruit_type.length ? filters.recruit_type.join(',') : undefined,
      job_category: filters.job_category.length ? filters.job_category.join(',') : undefined,
      company: filters.company.length ? filters.company.join(',') : undefined,
      sort: sortMode,
      page,
      page_size: PAGE_SIZE,
    }),
    [debouncedQ, filters, sortMode, page],
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
    matchJobs(
      resumeText,
      data.items.slice(0, 50).map((j) => j.id),
    )
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

  const chips = toFilterChips(filters);

  const handleSearch = (q: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (q) next.set('q', q);
      else next.delete('q');
      next.delete('page');
      return next;
    });
  };

  const handleToggle = (key: keyof JobFilters, value: string) => {
    setFilters((prev) => {
      const current = prev[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      sp.delete('page');
      return sp;
    });
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      sp.delete('page');
      sp.delete('q');
      return sp;
    });
  };

  const handlePageChange = (p: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showHints = !keyword && chips.length === 0;

  return (
    <div>
      {/* 工具带：检索 + 筛选，同一条轴线 */}
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <SearchBar keyword={keyword} onSearch={handleSearch} />
            <div className="min-w-0 lg:ml-auto">
              <JobFilterBar filters={filters} onToggle={handleToggle} params={params} />
            </div>
          </div>

          {chips.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-micro text-muted">已选</span>
              {chips.map((c) => (
                <button
                  key={`${c.key}:${c.value}`}
                  type="button"
                  onClick={() => handleToggle(c.key, c.value)}
                  className="flex items-center gap-1 rounded-md border border-ink/25 bg-surface-container px-1.5 py-0.5 text-micro text-ink transition-colors hover:border-ink"
                  aria-label={`取消筛选 ${c.value}`}
                >
                  {c.value}
                  <Icon name="close" size={12} strokeWidth={2} />
                </button>
              ))}
              <button
                type="button"
                onClick={handleReset}
                className="ml-1 text-micro text-muted underline decoration-line underline-offset-2 transition-colors hover:text-ink"
              >
                全部清空
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
        {/* 结果说明 + 排序 */}
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-body text-ink">
            <span className="num font-medium">{(data?.total ?? 0).toLocaleString('zh-CN')}</span>
            <span className="text-muted"> 个职位</span>
          </span>

          {keyword && <span className="text-meta text-muted">关键词「{keyword}」</span>}

          {showHints && (
            <span className="flex items-center gap-1.5 text-micro text-muted">
              <span>试试</span>
              {HOT_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSearch(q)}
                  className="underline decoration-line underline-offset-2 transition-colors hover:text-ink hover:decoration-ink"
                >
                  {q}
                </button>
              ))}
            </span>
          )}

          <div
            className="ml-auto flex items-center rounded-md border border-line p-px"
            role="group"
            aria-label="排序方式"
          >
            {(
              [
                ['latest', '最新发布'],
                ['relevance', '相关度'],
              ] as const
            ).map(([value, label]) => {
              const disabled = value === 'relevance' && !debouncedQ;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSortMode(value)}
                  title={disabled ? '输入关键词后可按相关度排序' : undefined}
                  className={`rounded-[5px] px-2.5 py-1 text-micro transition-colors ${
                    sortMode === value
                      ? 'bg-primary font-medium text-on-primary'
                      : 'text-muted hover:text-ink'
                  } ${disabled ? 'cursor-not-allowed opacity-40 hover:text-muted' : ''}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading && <Spinner />}
        {isError && (
          <ErrorState
            message={error instanceof Error ? error.message : '加载失败'}
            onRetry={() => refetch()}
          />
        )}

        {data && data.items.length === 0 && !isLoading && (
          <EmptyState
            icon="search"
            title="没有匹配的职位"
            description="换个关键词，或者去掉几个筛选条件再试"
          />
        )}

        {data && data.items.length > 0 && (
          // grid-cols-1 不能省：不写的单列轨道会按 max-content 撑开（标题是 nowrap），
          // 在窄屏上直接把卡片顶出视口
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                matchScore={matchScores[String(job.id)]}
                sortedByDate={sortMode === 'latest'}
              />
            ))}
          </div>
        )}

        {data && data.total > PAGE_SIZE && (
          <Pagination
            total={data.total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}
