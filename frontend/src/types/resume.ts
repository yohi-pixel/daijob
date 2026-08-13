export type ModuleType =
  | 'basic_info'
  | 'experience'
  | 'education'
  | 'award'
  | 'skill'
  | 'summary';

export interface ModuleDataBasicInfo {
  name?: string;
  phone?: string;
  email?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  birth_year?: number;
  gender?: '' | 'male' | 'female';
}

export interface ModuleDataExperience {
  org: string;
  role: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  description?: string;
}

export interface ModuleDataEducation {
  school: string;
  degree: string;
  major?: string;
  start_date?: string;
  end_date?: string;
  gpa?: string;
  description?: string;
}

export interface ModuleDataSkill {
  category: string;
  items: string[];
  proficiency?: 'familiar' | 'proficient' | 'expert';
}

export interface ModuleDataAward {
  name: string;
  issuer?: string;
  date?: string;
  description?: string;
}

export interface ModuleDataSummary {
  content: string;
}

export type ModuleData =
  | ({ kind: 'basic_info' } & ModuleDataBasicInfo)
  | ({ kind: 'experience' } & ModuleDataExperience)
  | ({ kind: 'education' } & ModuleDataEducation)
  | ({ kind: 'skill' } & ModuleDataSkill)
  | ({ kind: 'award' } & ModuleDataAward)
  | ({ kind: 'summary' } & ModuleDataSummary);

export type SerializedModuleData = Record<string, unknown>;

export interface ResumeModule {
  id: string;
  module_type: ModuleType;
  tags: string[];
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  source: 'manual' | 'ai_generated' | 'upload';
  cloned_from: string | null;
  data: SerializedModuleData;
}

export interface SnapshotSection {
  module_type: ModuleType;
  order: number;
  content: SerializedModuleData;
}

export interface ResumeSnapshot {
  id: string;
  name: string;
  target_tags: string[];
  created_at: string;
  updated_at: string;
  sections: SnapshotSection[];
}

export const QUOTA: Record<'basic_info' | 'experience' | 'summary' | 'skill' | 'snapshots', number> = {
  basic_info: 1,
  experience: 10,
  summary: 5,
  skill: 1,
  snapshots: 2,
};

export const EXPERIENCE_TYPES: ModuleType[] = ['experience', 'education', 'award'];

export const MODULE_TYPE_LABELS: Record<ModuleType, string> = {
  basic_info: '基本信息',
  experience: '经历',
  education: '教育经历',
  award: '奖项荣誉',
  skill: '技能',
  summary: '自我描述',
};

export const MODULE_ORDER: ModuleType[] = ['basic_info', 'experience', 'education', 'award', 'skill', 'summary'];
