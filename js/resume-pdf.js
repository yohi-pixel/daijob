/**
 * resume-pdf.js
 * PDF export for resume snapshots. Three templates: classic, modern, minimal.
 * Uses html2pdf.js (loaded via CDN in the calling page).
 */

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(s) {
  if (!s) return '';
  return String(s).replace(/-/g, '.');
}

// ── Section renderers (shared) ─────────────────────────────────────────────
function renderSection(section, template) {
  const { module_type: type, content: d } = section;
  if (!d) return '';
  switch (type) {
    case 'basic_info': return renderBasicInfo(d, template);
    case 'work_experience': return renderWorkExp(d, template);
    case 'project': return renderProject(d, template);
    case 'research': return renderResearch(d, template);
    case 'education': return renderEducation(d, template);
    case 'skill': return renderSkill(d, template);
    case 'award': return renderAward(d, template);
    case 'certificate': return renderCertificate(d, template);
    case 'summary': return renderSummary(d, template);
    default: return '';
  }
}

const TYPE_LABELS = {
  work_experience: '工作/实习经历', project: '项目经历', research: '科研经历',
  education: '教育经历', skill: '技能', award: '奖项荣誉',
  certificate: '证书资质', summary: '自我描述',
};

function highlights(arr) {
  if (!arr || arr.length === 0) return '';
  return `<ul style="margin:4px 0 0 0;padding-left:16px;">${arr.map(h => `<li style="margin-bottom:2px;">${esc(h)}</li>`).join('')}</ul>`;
}

function renderBasicInfo(d, _t) {
  const links = [d.linkedin && `LinkedIn: ${esc(d.linkedin)}`, d.github && `GitHub: ${esc(d.github)}`, d.website && esc(d.website)].filter(Boolean).join(' · ');
  return `<div class="basic-info">
    <div class="name">${esc(d.name)}</div>
    <div class="contact">${[d.phone, d.email, d.location].filter(Boolean).map(esc).join(' · ')}</div>
    ${links ? `<div class="contact-links">${links}</div>` : ''}
  </div>`;
}

function renderWorkExp(d, _t) {
  const period = [d.start_date, d.is_current ? '至今' : d.end_date].filter(Boolean).map(fmtDate).join(' — ');
  return `<div class="exp-item">
    <div class="exp-header"><span class="exp-company">${esc(d.company)}</span><span class="exp-period">${esc(period)}</span></div>
    <div class="exp-role">${esc(d.position)}${d.employment_type === 'internship' ? ' · 实习' : ''}</div>
    ${d.description ? `<p class="exp-desc">${esc(d.description)}</p>` : ''}
    ${highlights(d.highlights)}
  </div>`;
}

function renderProject(d, _t) {
  const period = [d.start_date, d.is_current ? '至今' : d.end_date].filter(Boolean).map(fmtDate).join(' — ');
  const stack = d.tech_stack?.length ? `<span class="tech-stack">${d.tech_stack.map(esc).join(' / ')}</span>` : '';
  return `<div class="exp-item">
    <div class="exp-header"><span class="exp-company">${esc(d.name)}</span><span class="exp-period">${esc(period)}</span></div>
    <div class="exp-role">${esc(d.role)}${stack}</div>
    ${d.description ? `<p class="exp-desc">${esc(d.description)}</p>` : ''}
    ${highlights(d.highlights)}
  </div>`;
}

function renderResearch(d, _t) {
  const period = [d.start_date, d.is_current ? '至今' : d.end_date].filter(Boolean).map(fmtDate).join(' — ');
  return `<div class="exp-item">
    <div class="exp-header"><span class="exp-company">${esc(d.institution)}</span><span class="exp-period">${esc(period)}</span></div>
    ${d.supervisor ? `<div class="exp-role">导师：${esc(d.supervisor)}</div>` : ''}
    <div class="exp-role">${esc(d.topic)}</div>
    ${d.description ? `<p class="exp-desc">${esc(d.description)}</p>` : ''}
    ${d.publications?.length ? `<ul style="margin:4px 0 0 0;padding-left:16px;">${d.publications.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

function renderEducation(d, _t) {
  const period = [d.start_date, d.end_date].filter(Boolean).map(fmtDate).join(' — ');
  return `<div class="exp-item">
    <div class="exp-header"><span class="exp-company">${esc(d.school)}</span><span class="exp-period">${esc(period)}</span></div>
    <div class="exp-role">${[d.degree, d.major].filter(Boolean).map(esc).join(' · ')}${d.gpa ? ` · GPA ${esc(d.gpa)}` : ''}</div>
    ${d.description ? `<p class="exp-desc">${esc(d.description)}</p>` : ''}
  </div>`;
}

function renderSkill(d, _t) {
  return `<div class="skill-item"><span class="skill-cat">${esc(d.category)}：</span>${(d.items||[]).map(esc).join(' · ')}</div>`;
}

function renderAward(d, _t) {
  return `<div class="exp-item">
    <div class="exp-header"><span class="exp-company">${esc(d.title)}</span><span class="exp-period">${esc(fmtDate(d.date))}</span></div>
    ${d.issuer ? `<div class="exp-role">${esc(d.issuer)}</div>` : ''}
    ${d.description ? `<p class="exp-desc">${esc(d.description)}</p>` : ''}
  </div>`;
}

function renderCertificate(d, _t) {
  return `<div class="exp-item">
    <div class="exp-header"><span class="exp-company">${esc(d.name)}</span><span class="exp-period">${esc(fmtDate(d.date))}</span></div>
    ${d.issuer ? `<div class="exp-role">${esc(d.issuer)}</div>` : ''}
  </div>`;
}

function renderSummary(d, _t) {
  return `<p class="summary-text">${esc(d.content)}</p>`;
}

// ── Template: Classic ─────────────────────────────────────────────────────
function buildClassicHTML(snapshot, photoDataUrl) {
  const basicSection = snapshot.sections.find(s => s.module_type === 'basic_info');
  const otherSections = snapshot.sections.filter(s => s.module_type !== 'basic_info');
  const rendered = [];
  let lastType = null;
  for (const sec of otherSections) {
    if (sec.module_type !== lastType) {
      rendered.push(`<div class="section-title">${esc(TYPE_LABELS[sec.module_type] || sec.module_type)}</div>`);
      lastType = sec.module_type;
    }
    rendered.push(renderSection(sec, 'classic'));
  }
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
  .tech-stack{font-size:8pt;color:#666;margin-left:6px}
  .skill-item{font-size:9pt;margin-bottom:4px}
  .skill-cat{font-weight:700}
  .summary-text{font-size:9pt;line-height:1.7;color:#333}
  ul{font-size:9pt;color:#333;line-height:1.6}
  ${photoDataUrl ? '.photo{float:right;width:60px;height:75px;object-fit:cover;margin-left:12px}' : ''}
</style></head><body>
  ${photoDataUrl ? `<img class="photo" src="${photoDataUrl}" alt="photo">` : ''}
  ${basicSection ? renderSection(basicSection, 'classic') : ''}
  ${rendered.join('\n')}
</body></html>`;
}

// ── Template: Modern ──────────────────────────────────────────────────────
function buildModernHTML(snapshot, photoDataUrl) {
  const basicSection = snapshot.sections.find(s => s.module_type === 'basic_info');
  const leftTypes = ['education', 'skill'];
  const leftSections = snapshot.sections.filter(s => leftTypes.includes(s.module_type));
  const rightSections = snapshot.sections.filter(s => s.module_type !== 'basic_info' && !leftTypes.includes(s.module_type));
  function renderGroup(sections) {
    const out = []; let lastType = null;
    for (const sec of sections) {
      if (sec.module_type !== lastType) { out.push(`<div class="section-title">${esc(TYPE_LABELS[sec.module_type] || sec.module_type)}</div>`); lastType = sec.module_type; }
      out.push(renderSection(sec, 'modern'));
    }
    return out.join('\n');
  }
  const basic = basicSection?.content || {};
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
  .tech-stack{font-size:8pt;color:#888;margin-left:6px}
  .skill-item{font-size:8.5pt;margin-bottom:4px;color:#ddd}
  .skill-cat{font-weight:700;color:#ff7a34}
  .summary-text{font-size:8.5pt;line-height:1.7;color:#444}
  ul{font-size:8.5pt;color:#444;line-height:1.6}
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

// ── Template: Minimal ─────────────────────────────────────────────────────
function buildMinimalHTML(snapshot, photoDataUrl) {
  const basicSection = snapshot.sections.find(s => s.module_type === 'basic_info');
  const otherSections = snapshot.sections.filter(s => s.module_type !== 'basic_info');
  const rendered = []; let lastType = null;
  for (const sec of otherSections) {
    if (sec.module_type !== lastType) { rendered.push(`<div class="section-title">${esc((TYPE_LABELS[sec.module_type] || sec.module_type).toUpperCase())}</div>`); lastType = sec.module_type; }
    rendered.push(renderSection(sec, 'minimal'));
  }
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
  .tech-stack{font-size:8pt;color:#999;margin-left:6px}
  .skill-item{font-size:8.5pt;margin-bottom:5px}
  .skill-cat{font-weight:600}
  .summary-text{font-size:8.5pt;line-height:1.8;color:#444}
  ul{font-size:8.5pt;color:#444;line-height:1.7}
  ${photoDataUrl ? '.photo{float:right;width:55px;height:68px;object-fit:cover;margin-left:14px}' : ''}
</style></head><body>
  ${photoDataUrl ? `<img class="photo" src="${photoDataUrl}" alt="photo">` : ''}
  ${basicSection ? renderSection(basicSection, 'minimal') : ''}
  ${rendered.join('\n')}
</body></html>`;
}

// ── Export entry point ────────────────────────────────────────────────────
/**
 * Show template picker + optional photo upload, then export snapshot to PDF.
 * Requires html2pdf.js to be loaded on the page (lazy-loaded if absent).
 * @param {object} snapshot
 */
export async function exportSnapshotToPDF(snapshot) {
  const template = await pickTemplate();
  if (!template) return;
  const photoDataUrl = await pickPhoto();
  let html;
  if (template === 'classic') html = buildClassicHTML(snapshot, photoDataUrl);
  else if (template === 'modern') html = buildModernHTML(snapshot, photoDataUrl);
  else html = buildMinimalHTML(snapshot, photoDataUrl);

  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.cssText = 'position:absolute;left:-9999px;top:0;';
  document.body.appendChild(container);
  try {
    if (!window.html2pdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
    await window.html2pdf().set({
      margin: 0,
      filename: `${snapshot.name || 'resume'}_${template}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(container.firstElementChild).save();
  } finally {
    document.body.removeChild(container);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function pickTemplate() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `<div style="background:#fff;border-radius:16px;padding:28px;max-width:480px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <h3 style="font-family:system-ui;font-size:16px;font-weight:700;margin-bottom:16px;">选择简历模板</h3>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
        ${[{id:'classic',label:'Classic',desc:'传统正式'},{id:'modern',label:'Modern',desc:'现代双栏'},{id:'minimal',label:'Minimal',desc:'极简线条'}].map(t =>
          `<button data-tpl="${t.id}" style="border:2px solid #e0e0e0;border-radius:10px;padding:14px 8px;cursor:pointer;background:#fff;font-family:system-ui;"
            onmouseover="this.style.borderColor='#9d3d00'" onmouseout="this.style.borderColor='#e0e0e0'">
            <div style="font-weight:700;font-size:13px;">${t.label}</div>
            <div style="font-size:11px;color:#666;margin-top:3px;">${t.desc}</div>
          </button>`).join('')}
      </div>
      <button id="pdfCancelBtn" style="font-family:system-ui;font-size:13px;color:#666;background:none;border:none;cursor:pointer;">取消</button>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-tpl]').forEach(btn => {
      btn.addEventListener('click', () => { document.body.removeChild(overlay); resolve(btn.dataset.tpl); });
    });
    overlay.querySelector('#pdfCancelBtn').addEventListener('click', () => { document.body.removeChild(overlay); resolve(null); });
  });
}

function pickPhoto() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `<div style="background:#fff;border-radius:16px;padding:28px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);font-family:system-ui;">
      <h3 style="font-size:15px;font-weight:700;margin-bottom:8px;">添加照片（可选）</h3>
      <p style="font-size:12px;color:#666;margin-bottom:16px;">照片仅用于本次导出，不会保存到本地</p>
      <input type="file" id="photoFileInput" accept="image/*" style="font-size:12px;margin-bottom:16px;display:block;">
      <div style="display:flex;gap:10px;">
        <button id="photoSkipBtn" style="flex:1;padding:10px;border:1px solid #e0e0e0;border-radius:8px;background:#fff;cursor:pointer;font-size:13px;">跳过</button>
        <button id="photoConfirmBtn" style="flex:1;padding:10px;background:#9d3d00;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">确认</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#photoSkipBtn').addEventListener('click', () => { document.body.removeChild(overlay); resolve(null); });
    overlay.querySelector('#photoConfirmBtn').addEventListener('click', () => {
      const file = overlay.querySelector('#photoFileInput').files[0];
      if (!file) { document.body.removeChild(overlay); resolve(null); return; }
      const reader = new FileReader();
      reader.onload = e => { document.body.removeChild(overlay); resolve(e.target.result); };
      reader.readAsDataURL(file);
    });
  });
}
