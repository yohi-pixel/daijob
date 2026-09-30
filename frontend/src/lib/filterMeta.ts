import type { JobFilters } from '../types/job';

export const FILTER_GROUPS = [
  { key: 'city', label: '城市' },
  { key: 'recruit_type', label: '招聘类型' },
  { key: 'job_category', label: '职位类别' },
  { key: 'company', label: '公司' },
] as const satisfies ReadonlyArray<{ key: keyof JobFilters; label: string }>;

export const EMPTY_FILTERS: JobFilters = {
  city: [],
  recruit_type: [],
  job_category: [],
  company: [],
};

export interface FilterChip {
  key: keyof JobFilters;
  /** 所属分组名，例如「城市」 */
  group: string;
  value: string;
}

/** 把筛选状态摊平成可逐个删除的标签 */
export function toFilterChips(filters: JobFilters): FilterChip[] {
  return FILTER_GROUPS.flatMap(({ key, label }) =>
    filters[key].map((value) => ({ key, group: label, value })),
  );
}
