const RESUME_STORAGE_KEY = 'yesjob_resume_modules';

function getResumeModules() {
  const data = localStorage.getItem(RESUME_STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveResumeModules(modules) {
  localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(modules));
}

function addResumeModule(module) {
  const modules = getResumeModules();
  module.id = Date.now().toString();
  module.createdAt = new Date().toISOString();
  modules.push(module);
  saveResumeModules(modules);
  return module;
}

function updateResumeModule(id, updates) {
  const modules = getResumeModules();
  const index = modules.findIndex(m => m.id === id);
  if (index === -1) return null;
  modules[index] = { ...modules[index], ...updates, updatedAt: new Date().toISOString() };
  saveResumeModules(modules);
  return modules[index];
}

function deleteResumeModule(id) {
  const modules = getResumeModules();
  const filtered = modules.filter(m => m.id !== id);
  saveResumeModules(filtered);
  return filtered.length < modules.length;
}

function getResumeModule(id) {
  const modules = getResumeModules();
  return modules.find(m => m.id === id) || null;
}

function assembleResumeText(moduleIds = null) {
  const modules = getResumeModules();
  const selected = moduleIds
    ? modules.filter(m => moduleIds.includes(m.id))
    : modules;
  return selected.map(m => m.content || '').join('\n\n');
}

export {
  getResumeModules,
  saveResumeModules,
  addResumeModule,
  updateResumeModule,
  deleteResumeModule,
  getResumeModule,
  assembleResumeText,
};
