import { useQuery } from '@tanstack/react-query';
import { MultiSelectFilter } from '../common/MultiSelectFilter';
import { getFilters, getDynamicFilters } from '../../services/jobsApi';
import type { JobQueryParams } from '../../types/job';

export interface FilterState {
  city: string[];
  recruit_type: string[];
  job_category: string[];
  company: string[];
}

interface JobFilterSidebarProps {
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
  onReset: () => void;
  params: JobQueryParams;
}

const FILTER_GROUPS = [
  { key: 'city', label: '城市' },
  { key: 'recruit_type', label: '招聘类型' },
  { key: 'job_category', label: '职位类别' },
  { key: 'company', label: '公司' },
] as const;

export function JobFilterSidebar({ filters, onFiltersChange, onReset, params }: JobFilterSidebarProps) {
  const { data: meta } = useQuery({ queryKey: ['filters'], queryFn: getFilters });

  // 动态筛选：当前筛选态下剩余选项（排除自身维度）
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

  const toggle = (key: keyof FilterState, opt: string) => {
    const current = filters[key];
    const next = current.includes(opt) ? current.filter((v) => v !== opt) : [...current, opt];
    onFiltersChange({ ...filters, [key]: next });
  };

  const groupMap = {
    city: source?.cities ?? [],
    recruit_type: source?.recruit_types ?? [],
    job_category: source?.job_categories ?? [],
    company: source?.companies ?? [],
  };

  return (
    <div className="space-y-4">
      {FILTER_GROUPS.map(({ key, label }) => (
        <MultiSelectFilter
          key={key}
          label={label}
          options={groupMap[key]}
          value={filters[key]}
          onToggle={(opt) => toggle(key, opt)}
        />
      ))}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onReset}
          className="text-xs text-on-surface-variant hover:text-error transition-colors"
        >
          重置筛选
        </button>
        <span className="text-xs text-on-surface-variant">
          {(filters.city.length + filters.recruit_type.length + filters.job_category.length + filters.company.length) > 0 &&
            `${filters.city.length + filters.recruit_type.length + filters.job_category.length + filters.company.length} 个筛选`}
        </span>
      </div>
    </div>
  );
}
