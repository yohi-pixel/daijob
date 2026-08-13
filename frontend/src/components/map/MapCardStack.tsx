import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getJobs } from '../../services/jobsApi';
import { useSavedJobs } from '../../hooks/useSavedJobs';
import type { JobSummary } from '../../types/job';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';

const MAX_VISIBLE = 3;
const SKIP_THRESHOLD = 80; // px

/**
 * 卡片堆叠模式：一次显示最多 3 张（缩放叠加），
 * 交互：双击/双 tap 收藏、单击 260ms 防抖进详情、上滑 >80px 跳过。
 */
export function MapCardStack() {
  const navigate = useNavigate();
  const { isSaved, toggleSave } = useSavedJobs();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['map-jobs'],
    queryFn: () => getJobs({ page: 1, page_size: 50 }),
    staleTime: 60_000,
  });

  const jobs = data?.items ?? [];
  const [startIndex, setStartIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  // 手势状态
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef(0);
  const lastTapTime = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = jobs.slice(startIndex, startIndex + MAX_VISIBLE);

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

  // 单击进详情（260ms 防抖，双击时取消）
  const handleTap = (job: JobSummary) => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      // 双击 → 收藏，取消单击
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

  // 触摸：上滑跳过
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

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="加载失败" onRetry={() => refetch()} />;
  if (jobs.length === 0) return <EmptyState title="暂无职位数据" />;
  if (visible.length === 0) return <EmptyState icon="check_circle" title="全部看完啦" description="点击下方刷新可重新开始" />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-on-surface">地图模式</h1>
        <span className="text-xs text-on-surface-variant">滑动卡片探索职位</span>
      </div>

      {/* 卡片堆叠区 */}
      <div className="relative h-[480px]" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {visible.map((job, i) => {
          const saved = isSaved(job.id);
          const scale = 1 - i * 0.04;
          const translateY = i * 10;
          return (
            <div
              key={job.id}
              className={`absolute inset-x-0 top-0 rounded-2xl bg-surface border border-outline-variant/30 shadow-lg p-6 transition-all ${
                animating && i === 0 ? 'opacity-0 -translate-y-8 scale-95' : ''
              }`}
              style={{
                transform: `scale(${scale}) translateY(${translateY}px)`,
                zIndex: MAX_VISIBLE - i,
                transition: 'transform 0.2s ease, opacity 0.2s ease',
              }}
            >
              {/* 卡片内容 */}
              <div
                className="min-h-[360px] flex flex-col cursor-pointer"
                onClick={() => handleTap(job)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  toggleSave(job);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h2 className="font-bold text-lg text-on-surface truncate">{job.title ?? '未命名职位'}</h2>
                    <p className="text-sm text-on-surface-variant mt-1">{job.company ?? '未知公司'}</p>
                  </div>
                  <span className={`material-symbols-outlined ${saved ? 'text-primary' : 'text-outline-variant'}`}>
                    {saved ? 'bookmark' : 'bookmark_border'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {job.work_city && (
                    <span className="text-xs bg-surface-container-low px-2.5 py-1 rounded-full text-on-surface-variant">{job.work_city}</span>
                  )}
                  {job.recruit_type && (
                    <span className="text-xs bg-surface-container-low px-2.5 py-1 rounded-full text-on-surface-variant">{job.recruit_type}</span>
                  )}
                  {job.job_category && (
                    <span className="text-xs bg-primary-container/20 px-2.5 py-1 rounded-full text-on-primary-container">{job.job_category}</span>
                  )}
                </div>

                <div className="mt-auto pt-6 text-center text-xs text-on-surface-variant">
                  单击查看详情 · 双击收藏 · 上滑跳过
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部按钮 */}
      <div className="flex items-center justify-center gap-6 mt-6 pb-10">
        <button
          onClick={skip}
          disabled={animating}
          className="w-14 h-14 rounded-full border border-outline-variant text-on-surface-variant flex items-center justify-center hover:border-error hover:text-error transition-colors disabled:opacity-40"
          title="跳过"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        {visible[0] && (
          <button
            onClick={() => toggleSave(visible[0])}
            className={`w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all ${
              isSaved(visible[0].id)
                ? 'bg-primary text-on-primary'
                : 'bg-surface border-2 border-primary text-primary hover:bg-primary-container/10'
            }`}
            title={isSaved(visible[0].id) ? '取消收藏' : '收藏'}
          >
            <span className="material-symbols-outlined text-[28px]">bookmark</span>
          </button>
        )}
      </div>
    </div>
  );
}
