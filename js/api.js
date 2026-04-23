const API_BASE_URL = '/api';

function getToken() {
  return localStorage.getItem('yesjob_token');
}

function setToken(token) {
  localStorage.setItem('yesjob_token', token);
}

function clearToken() {
  localStorage.removeItem('yesjob_token');
  localStorage.removeItem('yesjob_user');
}

function setUser(user) {
  localStorage.setItem('yesjob_user', JSON.stringify(user));
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('yesjob_user')); } catch { return null; }
}

async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // Only redirect on 401 for authenticated endpoints, not for login itself
      if (response.status === 401 && !endpoint.includes('/auth/')) {
        clearToken();
        window.location.href = '/pages/home.html';
      }
      throw new Error(error.detail || 'Request failed');
    }
    return await response.json();
  } catch (error) {
    if (!(error instanceof TypeError)) console.error('API Error:', error);
    throw error;
  }
}

async function register(username, email, password) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
}

async function login(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.access_token);
  setUser({ email });
  return data;
}

function logout() {
  clearToken();
  window.location.reload();
}

async function getJobs(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/jobs?${query}`);
}

async function getJobDetail(jobId) {
  return apiFetch(`/jobs/${jobId}`);
}

async function getFilters() {
  return apiFetch('/jobs/meta/filters');
}

async function getDynamicFilters(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/jobs/meta/dynamic-filters?${query}`);
}

async function matchJobs(resumeText, jobIds) {
  return apiFetch('/ai/match', {
    method: 'POST',
    body: JSON.stringify({ resume_text: resumeText, job_ids: jobIds }),
  });
}

async function optimizeResume(resumeText, jobId) {
  return apiFetch('/ai/optimize', {
    method: 'POST',
    body: JSON.stringify({ resume_text: resumeText, job_id: jobId }),
  });
}

export {
  getToken,
  setToken,
  clearToken,
  getUser,
  setUser,
  apiFetch,
  register,
  login,
  logout,
  getJobs,
  getJobDetail,
  getFilters,
  getDynamicFilters,
  matchJobs,
  optimizeResume,
};
