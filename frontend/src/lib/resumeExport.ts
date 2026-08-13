import type { ResumeSnapshot, SnapshotSection, ModuleType, SerializedModuleData } from '../types/resume';
import { MODULE_TYPE_LABELS } from '../types/resume';

function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(s: unknown): string {
  if (!s) return '';
  return String(s).replace(/-/g, '.');
}

// ── Section renderers（适配新 schema 6 类）──────────────────────────────────
function renderSection(section: SnapshotSection, _template: string): string {
  const { module_type: type, content: d } = section;
  if (!d) return '';
  switch (type) {
    case 'basic_info':
      return renderBasicInfo(d);
    case 'experience':
      return renderExperience(d);
    case 'education':
      return renderEducation(d);
    case 'skill':
      return renderSkill(d);
    case 'award':
      return renderAward(d);
    case 'summary':
      return renderSummary(d);
    default:
      return '';
  }
}

function renderBasicInfo(d: SerializedModuleData): string {
  const links = [
    d.linkedin && `LinkedIn: ${esc(d.linkedin)}`,
    d.github && `GitHub: ${esc(d.github)}`,
    d.website && esc(d.website),
  ]
    .filter(Boolean)
    .join(' · ');
  return `<div class="basic-info">
    <div class="name">${esc(d.name)}</div>
    <div class="contact">${[d.phone, d.email, d.location].filter(Boolean).map(esc).join(' · ')}</div>
    ${links ? `<div class="contact-links">${links}</div>` : ''}
  </div>`;
}

function renderExperience(d: SerializedModuleData): string {
  const period = [d.start_date, d.is_current ? '至今' : d.end_date].filter(Boolean).map(fmtDate).join(' — ');
  return `<div class="exp-item">
    <div class="exp-header"><span class="exp-company">${esc(d.org)}</span><span class="exp-period">${esc(period)}</span></div>
    <div class="exp-role">${esc(d.role)}</div>
    ${d.description ? `<p class="exp-desc">${esc(d.description)}</p>` : ''}
  </div>`;
}

function renderEducation(d: SerializedModuleData): string {
  const period = [d.start_date, d.end_date].filter(Boolean).map(fmtDate).join(' — ');
  return `<div class="exp-item">
    <div class="exp-header"><span class="exp-company">${esc(d.school)}</span><span class="exp-period">${esc(period)}</span></div>
    <div class="exp-role">${[d.degree, d.major].filter(Boolean).map(esc).join(' · ')}${d.gpa ? ` · GPA ${esc(d.gpa)}` : ''}</div>
    ${d.description ? `<p class="exp-desc">${esc(d.description)}</p>` : ''}
  </div>`;
}

function renderSkill(d: SerializedModuleData): string {
  return `<div class="skill-item"><span class="skill-cat">${esc(d.category)}：</span>${(Array.isArray(d.items) ? d.items : []).map(esc).join(' · ')}</div>`;
}

function renderAward(d: SerializedModuleData): string {
  return `<div class="exp-item">
    <div class="exp-header"><span class="exp-company">${esc(d.name)}</span><span class="exp-period">${esc(fmtDate(d.date))}</span></div>
    ${d.issuer ? `<div class="exp-role">${esc(d.issuer)}</div>` : ''}
    ${d.description ? `<p class="exp-desc">${esc(d.description)}</p>` : ''}
  </div>`;
}

function renderSummary(d: SerializedModuleData): string {
  return `<p class="summary-text">${esc(d.content)}</p>`;
}

// ── 模板构建 ───────────────────────────────────────────────────────────────
export type ResumeTemplate = 'classic' | 'modern' | 'minimal';

function renderGroup(sections: SnapshotSection[]): string {
  const out: string[] = [];
  let lastType: ModuleType | null = null;
  for (const sec of sections) {
    if (sec.module_type !== lastType) {
      out.push(`<div class="section-title">${esc(MODULE_TYPE_LABELS[sec.module_type] || sec.module_type)}</div>`);
      lastType = sec.module_type;
    }
    out.push(renderSection(sec, 'classic'));
  }
  return out.join('\n');
}

export function buildResumeHTML(snapshot: ResumeSnapshot, template: ResumeTemplate, photoDataUrl?: string | null): string {
  const basicSection = snapshot.sections.find((s) => s.module_type === 'basic_info');
  const otherSections = snapshot.sections.filter((s) => s.module_type !== 'basic_info');
  const basic = basicSection?.content || {};

  if (template === 'modern') {
    const leftTypes: ModuleType[] = ['education', 'skill'];
    const leftSections = snapshot.sections.filter((s) => leftTypes.includes(s.module_type));
    const rightSections = snapshot.sections.filter((s) => s.module_type !== 'basic_info' && !leftTypes.includes(s.module_type));
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Plus Jakarta Sans',sans-serif;font-size:9.5pt;color:#1a1a1a;background:#fff;width:210mm;min-height:297mm;display:flex}
  .left-col{width:62mm;background:#2d2f2e;color:#f0f0ee;padding:18mm 10mm;flex-shrink:0}
  .right-col{flex:1;padding:18mm 14mm}
  .left-col .name{font-size:16pt;font-weight:700;color:#fff;line-height:1.2;margin-bottom:4px}
  .left-col .contact{font-size:8pt;color:#b0b0ae;margin-top:8px;line-height:1.8}
  .left-col .section-title{font-size:8pt;font-weight:700;color:#ff7a34;text-transform:uppercase;letter-spacing:1.5px;margin:14px 0 6px}
  .right-col .section-title{font-size:10pt;font-weight:700;color:#9d3d00;border-left:3px solid #9d3d00;padding-left:8px;margin:14px 0 8px}
  .exp-item{margin-bottom:10px}
  .exp-header{display:flex;justify-content:space-between;font-weight:700;font-size:9.5pt}
  .exp-period{font-weight:400;color:#777;font-size:8.5pt}
  .exp-role{font-size:8.5pt;color:#555;margin-top:1px}
  .exp-desc{font-size:8.5pt;color:#444;margin-top:4px;line-height:1.6}
  .skill-item{font-size:8.5pt;margin-bottom:4px;color:#ddd}
  .skill-cat{font-weight:700;color:#ff7a34}
  .summary-text{font-size:8.5pt;line-height:1.7;color:#444}
  ${photoDataUrl ? '.photo{width:56px;height:70px;object-fit:cover;border-radius:4px;margin-bottom:10px;display:block}' : ''}
</style></head><body>
  <div class="left-col">
    ${photoDataUrl ? `<img class="photo" src="${photoDataUrl}" alt="photo">` : ''}
    <div class="name">${esc(basic.name || '')}</div>
    <div class="contact">${[basic.phone, basic.email, basic.location].filter(Boolean).map(esc).join('<br>')}</div>
    ${renderGroup(leftSections)}
  </div>
  <div class="right-col">${renderGroup(rightSections)}</div>
</body></html>`;
  }

  if (template === 'minimal') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',sans-serif;font-size:9.5pt;color:#111;background:#fff;width:210mm;min-height:297mm;padding:22mm 24mm}
  .basic-info{margin-bottom:20px}
  .name{font-size:24pt;font-weight:600;letter-spacing:-0.5px}
  .contact{font-size:8.5pt;color:#666;margin-top:6px}
  .contact-links{font-size:8pt;color:#888;margin-top:2px}
  .section-title{font-size:8pt;font-weight:600;letter-spacing:2px;color:#888;margin:20px 0 10px;border-bottom:1px solid #e0e0e0;padding-bottom:4px}
  .exp-item{margin-bottom:12px}
  .exp-header{display:flex;justify-content:space-between;font-weight:600;font-size:9.5pt}
  .exp-period{font-weight:400;color:#888;font-size:8.5pt}
  .exp-role{font-size:8.5pt;color:#555;margin-top:2px}
  .exp-desc{font-size:8.5pt;color:#444;margin-top:5px;line-height:1.7}
  .skill-item{font-size:8.5pt;margin-bottom:5px}
  .skill-cat{font-weight:600}
  .summary-text{font-size:8.5pt;line-height:1.8;color:#444}
  ${photoDataUrl ? '.photo{float:right;width:55px;height:68px;object-fit:cover;margin-left:14px}' : ''}
</style></head><body>
  ${photoDataUrl ? `<img class="photo" src="${photoDataUrl}" alt="photo">` : ''}
  ${basicSection ? renderSection(basicSection, 'minimal') : ''}
  ${renderGroup(otherSections)}
</body></html>`;
  }

  // classic（默认）
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Noto Serif SC',serif;font-size:10pt;color:#1a1a1a;background:#fff;width:210mm;min-height:297mm;padding:18mm 20mm}
  .basic-info{text-align:center;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #1a1a1a}
  .name{font-size:22pt;font-weight:700;letter-spacing:2px}
  .contact{font-size:9pt;color:#444;margin-top:4px}
  .contact-links{font-size:8pt;color:#666;margin-top:2px}
  .section-title{font-size:11pt;font-weight:700;border-bottom:1px solid #1a1a1a;padding-bottom:3px;margin:14px 0 8px;letter-spacing:1px}
  .exp-item{margin-bottom:10px}
  .exp-header{display:flex;justify-content:space-between;font-weight:700;font-size:10pt}
  .exp-period{font-weight:400;color:#555;font-size:9pt}
  .exp-role{font-size:9pt;color:#444;margin-top:1px}
  .exp-desc{font-size:9pt;color:#333;margin-top:4px;line-height:1.6}
  .skill-item{font-size:9pt;margin-bottom:4px}
  .skill-cat{font-weight:700}
  .summary-text{font-size:9pt;line-height:1.7;color:#333}
  ${photoDataUrl ? '.photo{float:right;width:60px;height:75px;object-fit:cover;margin-left:12px}' : ''}
</style></head><body>
  ${photoDataUrl ? `<img class="photo" src="${photoDataUrl}" alt="photo">` : ''}
  ${basicSection ? renderSection(basicSection, 'classic') : ''}
  ${renderGroup(otherSections)}
</body></html>`;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).html2pdf) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('加载导出库失败'));
    document.head.appendChild(s);
  });
}

/** 导出快照为 PDF（html2pdf 动态加载） */
export async function exportSnapshotToPDF(snapshot: ResumeSnapshot, template: ResumeTemplate, photoDataUrl?: string | null): Promise<void> {
  const html = buildResumeHTML(snapshot, template, photoDataUrl);
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.cssText = 'position:absolute;left:-9999px;top:0;';
  document.body.appendChild(container);
  try {
    if (!(window as any).html2pdf) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
    }
    await (window as any).html2pdf()
      .set({
        margin: 0,
        filename: `${snapshot.name || 'resume'}_${template}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(container.firstElementChild)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}

/** 导出快照为纯文本（Word 简易导出：下载 .doc 兼容文本） */
export function exportSnapshotToWord(snapshot: ResumeSnapshot): void {
  const parts: string[] = [];
  for (const sec of snapshot.sections) {
    const label = MODULE_TYPE_LABELS[sec.module_type] || sec.module_type;
    const d = sec.content;
    let body = '';
    switch (sec.module_type) {
      case 'basic_info':
        body = [d.name, d.phone, d.email, d.location].filter(Boolean).join(' | ');
        break;
      case 'experience':
        body = [d.org, d.role, d.start_date, d.end_date, d.description].filter(Boolean).join(' | ');
        break;
      case 'education':
        body = [d.school, d.degree, d.major, d.start_date, d.end_date, d.gpa, d.description].filter(Boolean).join(' | ');
        break;
      case 'skill':
        body = `${d.category || ''}：${(Array.isArray(d.items) ? d.items : []).join('、')}`;
        break;
      case 'award':
        body = [d.name, d.issuer, d.date, d.description].filter(Boolean).join(' | ');
        break;
      case 'summary':
        body = String(d.content ?? '');
        break;
    }
    parts.push(`${label}\n${body}`);
  }
  const text = `${snapshot.name || '简历'}\n\n${parts.join('\n\n')}`;
  const blob = new Blob([`\ufeff${text}`], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${snapshot.name || 'resume'}.doc`;
  a.click();
  URL.revokeObjectURL(a.href);
}
