/**
 * resume-store.js
 * localStorage CRUD + 配额管理，简历模块化数据层
 */

// ── Keys ──────────────────────────────────────────────────────────────────
const KEYS = {
  modules: 'yesjob_resume_modules',
  snapshots: 'yesjob_resume_snapshots',
};

// ── 配额 ──────────────────────────────────────────────────────────────────
export const QUOTA = {
  basic_info: 1,
  experience: 10,
  summary: 5,
  skill: 1,
  snapshots: 2,
};

export const EXPERIENCE_TYPES = ['experience', 'education', 'award'];

export const MODULE_TYPE_LABELS = {
  basic_info: '基本信息',
  experience: '经历',
  education: '教育经历',
  award: '奖项荣誉',
  skill: '技能',
  summary: '自我描述',
};

// ── ID 生成 ───────────────────────────────────────────────────────────────
export function generateId(prefix = 'mod') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── 模块 CRUD ─────────────────────────────────────────────────────────────
function readModules() {
  try { return JSON.parse(localStorage.getItem(KEYS.modules)) || []; } catch { return []; }
}

function writeModules(modules) {
  localStorage.setItem(KEYS.modules, JSON.stringify(modules));
}

/** 获取所有未删除模块 */
export function getModules() {
  return readModules().filter(m => !m.is_deleted);
}

/** 按类型获取模块 */
export function getModulesByType(type) {
  return getModules().filter(m => m.module_type === type);
}

/** 按标签获取模块 */
export function getModulesByTag(tag) {
  return getModules().filter(m => m.tags && m.tags.includes(tag));
}

/** 获取所有已用标签（去重） */
export function getAllTags() {
  const tags = new Set();
  getModules().forEach(m => (m.tags || []).forEach(t => tags.add(t)));
  return [...tags].sort();
}

/** 配额检查，返回 { ok: bool, message: string } */
export function checkQuota(type) {
  if (type === 'basic_info') {
    const count = getModulesByType('basic_info').length;
    if (count >= QUOTA.basic_info) return { ok: false, message: `基本信息最多保存 ${QUOTA.basic_info} 条` };
  } else if (type === 'summary') {
    const count = getModulesByType('summary').length;
    if (count >= QUOTA.summary) return { ok: false, message: `自我描述最多保存 ${QUOTA.summary} 条` };
  } else if (type === 'skill') {
    const count = getModulesByType('skill').length;
    if (count >= QUOTA.skill) return { ok: false, message: `技能模块最多保存 ${QUOTA.skill} 条` };
  } else if (EXPERIENCE_TYPES.includes(type)) {
    const count = EXPERIENCE_TYPES.reduce((sum, t) => sum + getModulesByType(t).length, 0);
    if (count >= QUOTA.experience) return { ok: false, message: `经历类模块合计最多 ${QUOTA.experience} 条` };
  }
  return { ok: true };
}

/** 新增模块，返回新模块或抛出配额错误 */
export function addModule(type, data, tags = []) {
  const quota = checkQuota(type);
  if (!quota.ok) throw new Error(quota.message);
  const now = new Date().toISOString();
  const module = {
    id: generateId('mod'),
    module_type: type,
    tags,
    is_deleted: false,
    created_at: now,
    updated_at: now,
    source: 'manual',
    cloned_from: null,
    data,
  };
  const all = readModules();
  all.unshift(module);
  writeModules(all);
  return module;
}

/** 更新模块 data 和/或 tags */
export function updateModule(id, { data, tags } = {}) {
  const all = readModules();
  const idx = all.findIndex(m => m.id === id);
  if (idx === -1) throw new Error('模块不存在');
  if (data !== undefined) all[idx].data = data;
  if (tags !== undefined) all[idx].tags = tags;
  all[idx].updated_at = new Date().toISOString();
  writeModules(all);
  return all[idx];
}

/** 软删除模块 */
export function deleteModule(id) {
  const all = readModules();
  const idx = all.findIndex(m => m.id === id);
  if (idx === -1) return;
  all[idx].is_deleted = true;
  all[idx].updated_at = new Date().toISOString();
  writeModules(all);
}

/** 深拷贝模块，生成新 ID */
export function cloneModule(id) {
  const original = readModules().find(m => m.id === id);
  if (!original) throw new Error('模块不存在');
  const quota = checkQuota(original.module_type);
  if (!quota.ok) throw new Error(quota.message);
  const now = new Date().toISOString();
  const cloned = JSON.parse(JSON.stringify(original));
  cloned.id = generateId('mod');
  cloned.cloned_from = original.id;
  cloned.source = 'manual';
  cloned.created_at = now;
  cloned.updated_at = now;
  const all = readModules();
  const origIdx = all.findIndex(m => m.id === id);
  all.splice(origIdx + 1, 0, cloned);
  writeModules(all);
  return cloned;
}

// ── 快照 CRUD ─────────────────────────────────────────────────────────────
function readSnapshots() {
  try { return JSON.parse(localStorage.getItem(KEYS.snapshots)) || []; } catch { return []; }
}

function writeSnapshots(snapshots) {
  localStorage.setItem(KEYS.snapshots, JSON.stringify(snapshots));
}

export function getSnapshots() {
  return readSnapshots();
}

/**
 * 新建快照
 * @param {string} name
 * @param {string[]} targetTags
 * @param {Array<{module_type, data}>} sections - 已深拷贝的模块内容数组（含顺序）
 */
export function addSnapshot(name, targetTags, sections) {
  const all = readSnapshots();
  if (all.length >= QUOTA.snapshots) throw new Error(`简历快照最多保存 ${QUOTA.snapshots} 份`);
  const now = new Date().toISOString();
  const snapshot = {
    id: generateId('snap'),
    name,
    target_tags: targetTags,
    created_at: now,
    updated_at: now,
    sections: JSON.parse(JSON.stringify(sections)), // 深拷贝
  };
  all.unshift(snapshot);
  writeSnapshots(all);
  return snapshot;
}

export function updateSnapshot(id, { name, targetTags, sections } = {}) {
  const all = readSnapshots();
  const idx = all.findIndex(s => s.id === id);
  if (idx === -1) throw new Error('快照不存在');
  if (name !== undefined) all[idx].name = name;
  if (targetTags !== undefined) all[idx].target_tags = targetTags;
  if (sections !== undefined) all[idx].sections = JSON.parse(JSON.stringify(sections));
  all[idx].updated_at = new Date().toISOString();
  writeSnapshots(all);
  return all[idx];
}

export function deleteSnapshot(id) {
  writeSnapshots(readSnapshots().filter(s => s.id !== id));
}

// ── 存储用量 ──────────────────────────────────────────────────────────────
/** 估算 localStorage 已用空间（KB） */
export function getStorageUsageKB() {
  let total = 0;
  for (const key in localStorage) {
    if (!localStorage.hasOwnProperty(key)) continue;
    total += (localStorage.getItem(key) || '').length + key.length;
  }
  return Math.round(total / 1024);
}

/** 各类型配额使用情况 */
export function getQuotaStatus() {
  const expCount = EXPERIENCE_TYPES.reduce((sum, t) => sum + getModulesByType(t).length, 0);
  return {
    basic_info: { used: getModulesByType('basic_info').length, max: QUOTA.basic_info },
    experience: { used: expCount, max: QUOTA.experience },
    summary: { used: getModulesByType('summary').length, max: QUOTA.summary },
    skill: { used: getModulesByType('skill').length, max: QUOTA.skill },
    snapshots: { used: getSnapshots().length, max: QUOTA.snapshots },
  };
}
