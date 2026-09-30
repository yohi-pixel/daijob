import { useQuery } from '@tanstack/react-query';
import { MultiSelectFilter } from '../common/MultiSelectFilter';
import { getFilters, getDynamicFilters } from '../../services/jobsApi';
import { FILTER_GROUPS } from '../../lib/filterMeta';
import type { JobFilters, JobQueryParams } from '../../types/job';

interface JobFilterBarProps {
  filters: JobFilters;
  onToggle: (key: keyof JobFilters, value: string) => void;
  params: JobQueryParams;
}

const TRIGGER_WIDTH: Record<string, string> = {
  city: 'max-w-[7.5rem]',
  recruit_type: 'max-w-[8.5rem]',
  job_category: 'max-w-[8.5rem]',
  company: 'max-w-[8rem]',
};

/**
 * 筛选触发器一行排开。原来是左侧一整列四个下拉，
 * 现在收成一条工具带 —— 列表因此拿回了纵向空间与整幅宽度。
 * 选项随当前筛选动态收敛（选了肇庆之后城市列表只剩肇庆，避免选出空集）。
 */
export function JobFilterBar({ filters, onToggle, params }: JobFilterBarProps) {
  const { data: meta } = useQuery({ queryKey: ['filters'], queryFn: getFilters });

  const { data: dynamic } = useQuery({
    queryKey: ['dynamic-filters', params],
    queryFn: () =>
      getDynamicFilters({
        q: params.q,
        city: filters.city.join(','),
        recruit_type: filters.recruit_type.join(','),
        job_category: filters.job_category.join(','),
        company: filters.company.join(','),
      }),
    staleTime: 15_000,
  });

  const source = dynamic ?? meta;

  const optionsFor = (key: keyof JobFilters): string[] => {
    if (!source) return [];
    if (key === 'city') return source.cities ?? [];
    if (key === 'recruit_type') return source.recruit_types ?? [];
    if (key === 'job_category') return source.job_categories ?? [];
    return source.companies ?? [];
  };

  return (
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto no-scrollbar">
      {FILTER_GROUPS.map(({ key, label }) => (
        <MultiSelectFilter
          key={key}
          label={label}
          options={optionsFor(key)}
          value={filters[key]}
          onToggle={(opt) => onToggle(key, opt)}
          triggerClassName={TRIGGER_WIDTH[key]}
        />
      ))}
    </div>
  );
}
