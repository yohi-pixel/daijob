export interface JobSummary {
  id: number;
  job_id: string;
  company: string | null;
  title: string | null;
  recruit_type: string | null;
  job_category: string | null;
  work_city: string | null;
  publish_time: string | null;
  detail_url: string | null;
}

export interface JobDetail extends JobSummary {
  job_function: string | null;
  work_cities: string[] | null;
  team_intro: string | null;
  responsibilities: string | null;
  requirements: string | null;
  bonus_points: string | null;
  tags: string[] | null;
  fetched_at: string | null;
}

export interface JobListResponse {
  total: number;
  page: number;
  page_size: number;
  items: JobSummary[];
}

export interface FiltersResponse {
  cities: string[];
  recruit_types: string[];
  job_categories: string[];
  companies: string[];
}

export interface DynamicFiltersResponse extends FiltersResponse {}

export interface JobQueryParams {
  q?: string;
  city?: string;
  recruit_type?: string;
  job_category?: string;
  company?: string;
  sort?: 'latest' | 'relevance';
  page?: number;
  page_size?: number;
}
