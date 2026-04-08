const API_BASE_URL = 'http://localhost:8000';

function getToken() {
  return sessionStorage.getItem('yesjob_token');
}

function setToken(token) {
  sessionStorage.setItem('yesjob_token', token);
}

function clearToken() {
  sessionStorage.removeItem('yesjob_token');
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
    if (response.status === 401) {
      clearToken();
      window.location.href = '/pages/home.html';
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Request failed');
    }
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
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
  return data;
}

function logout() {
  clearToken();
  window.location.href = '/pages/home.html';
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
