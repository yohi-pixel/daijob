import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getJobs, getJobDetail } from '../../services/jobsApi';
import { useSavedJobs } from '../../hooks/useSavedJobs';
import type { JobSummary } from '../../types/job';
import { Spinner } from '../common/Spinner';
import { EmptyState, ErrorState } from '../common/EmptyState';
import { Icon } from '../common/Icon';
import { ExploreCard } from './ExploreCard';

const MAX_VISIBLE = 3;
const SKIP_THRESHOLD = 80; // px
const DECK_SIZE = 60;

/**
 * 一张一张过筛。原先叫「地图模式」却没有任何地图 —— 改名为它真正在做的事。
 * 卡片补齐了职责/要求/标签，滑过去就能判断值不值得点开。
 */
export function ExploreCardStack() {
  const navigate = useNavigate();
  const { isSaved, toggleSave } = useSavedJobs();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['explore-jobs'],
    queryFn: () => getJobs({ page: 1, page_size: DECK_SIZE }),
    staleTime: 60_000,
  });

  const jobs = data?.items ?? [];
  const [startIndex, setStartIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  const visible = jobs.slice(startIndex, startIndex + MAX_VISIBLE);
  const top = visible[0];

  // 只预取最上面那张的详情，后面两张用不到
  const { data: detail } = useQuery({
    queryKey: ['job', top?.id],
    queryFn: () => getJobDetail(String(top!.id)),
    enabled: !!top,
    staleTime: 5 * 60_000,
  });

  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef(0);
  const lastTapTime = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const skip = () => {
    if (animating || startIndex + MAX_VISIBLE > jobs.length) return;
    setAnimating(true);
    setTimeout(() => {
      setStartIndex((i) => i + 1);
      setAnimating(false);
    }, 200);
  };

  const cleanupClickTimer = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
  };

  const handleTap = (job: JobSummary) => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      cleanupClickTimer();
      lastTapTime.current = 0;
      toggleSave(job);
      return;
    }
    lastTapTime.current = now;
    cleanupClickTimer();
    clickTimer.current = setTimeout(() => {
      navigate(`/jobs/${job.id}`);
    }, 260);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    const dt = Date.now() - touchStartTime.current;
    touchStartY.current = null;
    if (dy > SKIP_THRESHOLD && dt < 600) skip();
  };

  useEffect(() => cleanupClickTimer, []);

  if (isLoading) return <Spinner size="lg" />;
  if (isError) return <ErrorState message="没能取到职位数据" onRetry={() => refetch()} />;
  if (jobs.length === 0) {
    return <EmptyState title="暂时没有可探索的职位" description="先去职位列表看看，或稍后再来" />;
  }

  const restart = () => {
    setStartIndex(0);
    refetch();
  };

  if (visible.length === 0) {
    return (
      <EmptyState
        icon="check"
        title="这一批过完了"
        description={`刚刚浏览完 ${jobs.length} 个职位。重新开始会再打乱一轮。`}
      />
    );
  }

  const savedTop = top ? isSaved(top.id) : false;

  return (
    <div className="mx-auto max-w-lg px-4 pb-6 pt-5 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-medium text-ink">滑动探索</h1>
          <p className="mt-1 text-meta text-muted">
            一次一张，快速过筛。上滑跳过，双击收藏。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="num text-meta text-muted">
            {startIndex + 1} / {jobs.length}
          </span>
          <button
            type="button"
            onClick={restart}
            className="rounded-md border border-line p-1.5 text-muted transition-colors hover:border-outline hover:text-ink"
            aria-label="换一批"
            title="换一批"
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {/* 卡片堆叠 */}
      <div
        className="relative mt-4 h-[27rem] sm:h-[30rem]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {[...visible].reverse().map((job, revIdx) => {
          const depth = visible.length - 1 - revIdx;
          const isTop = depth === 0;
          const scale = 1 - depth * 0.035;
          const translateY = depth * 10;

          return (
            <div
              key={job.id}
              className={`absolute inset-x-0 top-0 h-full overflow-hidden rounded-3xl border bg-surface ${
                isTop ? 'border-line shadow-md' : 'border-line/70'
              } ${animating && isTop ? '-translate-y-6 scale-95 opacity-0' : ''}`}
              style={{
                transform: `scale(${scale}) translateY(${translateY}px)`,
                zIndex: MAX_VISIBLE - depth,
                transition: 'transform 0.2s ease, opacity 0.2s ease',
              }}
            >
              <div
                className="h-full p-5"
                onClick={isTop ? () => handleTap(job) : undefined}
                onDoubleClick={
                  isTop
                    ? (e) => {
                        e.stopPropagation();
                        toggleSave(job);
                      }
                    : undefined
                }
              >
                {isTop ? (
                  <ExploreCard
                    job={job}
                    detail={detail}
                    saved={isSaved(job.id)}
                    onToggleSave={() => toggleSave(job)}
                  />
                ) : (
                  <div className="flex h-full flex-col">
                    <h2 className="text-h2 font-medium leading-tight text-ink">
                      {job.title ?? '未命名职位'}
                    </h2>
                    <p className="mt-1 text-lead text-ink/80">{job.company ?? '未知公司'}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 操作区：手势之外，按钮在所有设备上都能用 */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={skip}
          disabled={animating}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line text-meta text-muted transition-colors hover:border-outline hover:text-ink disabled:opacity-40 sm:text-body"
        >
          <Icon name="close" size={17} />
          跳过
        </button>
        <button
          type="button"
          onClick={() => top && toggleSave(top)}
          className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-meta font-medium transition-colors sm:text-body ${
            savedTop
              ? 'bg-primary text-on-primary'
              : 'border border-ink/25 text-ink hover:border-ink'
          }`}
        >
          <Icon name={savedTop ? 'bookmark' : 'bookmark_border'} size={17} />
          {savedTop ? '已收藏' : '收藏'}
        </button>
        <button
          type="button"
          onClick={() => top && navigate(`/jobs/${top.id}`)}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-meta font-medium text-on-primary transition-colors hover:bg-secondary-dim sm:text-body"
        >
          看详情
        </button>
      </div>
    </div>
  );
}
