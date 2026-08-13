import type { ModuleType } from '../types/resume';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  placeholder?: string;
  isArray?: boolean;
  sep?: string;
  rows?: number;
  options?: Array<{ v: string; l: string }>;
}

/** 与旧 home.html FORM_FIELDS 一致的表单配置（驱动 ModuleForm 动态渲染） */
export const FORM_FIELDS: Record<ModuleType, FieldDef[]> = {
  basic_info: [
    { key: 'name', label: '姓名', type: 'text', required: true },
    { key: 'phone', label: '电话', type: 'text' },
    { key: 'email', label: '邮箱', type: 'email' },
    { key: 'location', label: '所在城市', type: 'text' },
    { key: 'linkedin', label: 'LinkedIn', type: 'text' },
    { key: 'github', label: 'GitHub', type: 'text' },
    { key: 'website', label: '个人网站', type: 'text' },
    { key: 'birth_year', label: '出生年份', type: 'number' },
    {
      key: 'gender',
      label: '性别',
      type: 'select',
      options: [
        { v: '', l: '不填' },
        { v: 'male', l: '男' },
        { v: 'female', l: '女' },
      ],
    },
  ],
  experience: [
    { key: 'org', label: '公司/项目名', type: 'text', required: true },
    { key: 'role', label: '职位/角色', type: 'text', required: true },
    { key: 'start_date', label: '开始时间', type: 'text', placeholder: '2023-07' },
    { key: 'end_date', label: '结束时间', type: 'text', placeholder: '2023-10' },
    { key: 'is_current', label: '至今', type: 'checkbox' },
    { key: 'description', label: '描述', type: 'textarea' },
  ],
  education: [
    { key: 'school', label: '学校', type: 'text', required: true },
    { key: 'degree', label: '学历', type: 'text', required: true },
    { key: 'major', label: '专业', type: 'text' },
    { key: 'start_date', label: '开始时间', type: 'text', placeholder: '2020-09' },
    { key: 'end_date', label: '结束时间', type: 'text', placeholder: '2024-06' },
    { key: 'gpa', label: 'GPA', type: 'text' },
    { key: 'description', label: '补充说明', type: 'textarea' },
  ],
  skill: [
    {
      key: 'category',
      label: '技能类别',
      type: 'text',
      required: true,
      placeholder: '编程语言 / 工具与框架 / 语言能力',
    },
    { key: 'items', label: '技能项（逗号分隔）', type: 'text', required: true, isArray: true, sep: ',' },
    {
      key: 'proficiency',
      label: '熟练度',
      type: 'select',
      options: [
        { v: 'familiar', l: '了解' },
        { v: 'proficient', l: '熟练' },
        { v: 'expert', l: '精通' },
      ],
    },
  ],
  award: [
    { key: 'name', label: '奖项名称', type: 'text', required: true },
    { key: 'issuer', label: '颁发机构', type: 'text' },
    { key: 'date', label: '获奖时间', type: 'text', placeholder: '2023-10' },
    { key: 'description', label: '补充说明', type: 'textarea' },
  ],
  summary: [{ key: 'content', label: '自我描述', type: 'textarea', required: true, rows: 6 }],
};

export const TAG_SUGGESTIONS = ['后端', '前端', '算法', 'AI', '产品', '实习', '校招', '数据', 'Go', 'Python'];
