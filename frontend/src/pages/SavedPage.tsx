import { useSavedJobs } from '../hooks/useSavedJobs';
import { EmptyState } from '../components/common/EmptyState';
import { JobCard } from '../components/jobs/JobCard';

/**
 * 收藏页复用职位卡 —— 同一个东西在两处长得一样，用户不用重新认一遍。
 * 卡片右上角书签图标就是移出收藏的开关。
 */
export function SavedPage() {
  const { saved } = useSavedJobs();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-lead font-medium text-ink">我的收藏</h1>
        <span className="text-meta text-muted">
          {saved.length > 0 ? (
            <>
              <span className="num">{saved.length}</span> 个职位 · 点书签图标即可移出
            </>
          ) : (
            '存在本机，换设备不会同步'
          )}
        </span>
      </div>

      {saved.length === 0 ? (
        <EmptyState
          icon="bookmark_border"
          title="还没有收藏的职位"
          description="在职位列表点右侧的书签图标，收藏的职位会集中在这里"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {saved.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
