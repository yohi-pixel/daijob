import type { ResumeModule } from '../types/resume';

/**
 * 从规范化 modules 生成聊天上下文文本（修复旧版 buildResumeContext 读 m.type 的 bug）。
 */
export function buildResumeContext(modules: ResumeModule[]): string {
  const active = modules.filter((m) => !m.is_deleted);
  if (active.length === 0) return '';
  const lines: string[] = [];

  for (const m of active) {
    const d = m.data || {};
    switch (m.module_type) {
      case 'basic_info':
        lines.push(`基本信息：${d.name || ''} ${d.phone || ''} ${d.email || ''}`.trim());
        break;
      case 'education':
        lines.push(
          `教育经历：${d.school || ''} ${d.degree || ''} ${d.major || ''} ${d.start_date || ''}${d.end_date ? `-${d.end_date}` : ''}`
            .trim(),
        );
        break;
      case 'experience':
        lines.push(
          `工作经历：${d.org || ''} ${d.role || ''} ${d.start_date || ''}${d.end_date ? `-${d.end_date}` : ''} ${d.description || ''}`
            .trim(),
        );
        break;
      case 'award':
        lines.push(`奖项荣誉：${d.name || ''} ${d.date || ''} ${d.description || ''}`.trim());
        break;
      case 'skill':
        lines.push(`技能：${d.category || ''} ${Array.isArray(d.items) ? d.items.join('、') : ''}`.trim());
        break;
      case 'summary':
        lines.push(`自我描述：${d.content || ''}`.trim());
        break;
    }
  }

  return lines.filter((l) => l && l.includes('：')).join('\n');
}

/** 从模块组装纯文本简历（match 打分用） */
export function assembleResumeText(modules: ResumeModule[]): string {
  const ctx = buildResumeContext(modules);
  return ctx.replace(/：/g, ': ').replace(/\n/g, '\n');
}
