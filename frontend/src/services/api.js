const API_URL = import.meta.env.VITE_API_URL || '/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

const handleResponse = async (r) => {
  const data = await r.json();
  if (!r.ok) return { success: false, message: data.message || 'Request failed' };
  return data;
};

const api = {
  get: (url) => fetch(`${API_URL}${url}`, { headers: getHeaders() }).then(handleResponse),
  post: (url, data) => fetch(`${API_URL}${url}`, {
    method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
  }).then(handleResponse),
  patch: (url, data) => fetch(`${API_URL}${url}`, {
    method: 'PATCH', headers: getHeaders(), body: JSON.stringify(data)
  }).then(handleResponse),
  delete: (url, data) => fetch(`${API_URL}${url}`, {
    method: 'DELETE', headers: getHeaders(), body: JSON.stringify(data)
  }).then(handleResponse),
  upload: (url, formData, method = 'POST') => {
    const token = localStorage.getItem('token');
    return fetch(`${API_URL}${url}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    }).then(async (r) => {
      const data = await r.json();
      // Pass through duplicate/conflict responses with full payload
      if (!r.ok) {
        return { success: false, ...data, message: data.message || 'Request failed' };
      }
      return data;
    });
  }
};

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => fetch(`${API_URL}/auth/profile`, {
    method: 'PUT', headers: getHeaders(), body: JSON.stringify(data)
  }).then(r => r.json())
};

export const issueAPI = {
  getCategories: () => api.get('/issues/categories'),
  getIssues: (params) => api.get(`/issues?${new URLSearchParams(params)}`),
  getIssue: (id) => api.get(`/issues/${id}`),
  createIssue: (formData) => api.upload('/issues', formData),
  vote: (id, vote) => api.post(`/issues/${id}/vote`, { vote }),
  verify: (id, resolved, comment) => api.post(`/issues/${id}/verify`, { resolved, comment }),
  updateStatus: (id, formData) => api.upload(`/issues/${id}/status`, formData, 'PATCH'),
  updateStatusJson: (id, data) => api.patch(`/issues/${id}/status`, data),
  deleteResolved: () => api.delete('/issues/bulk/resolved', { confirm: 'DELETE RESOLVED' }),
  deleteAll: () => api.delete('/issues/bulk/all', { confirm: 'DELETE ALL' }),
  getFeed: () => api.get('/issues/feed'),
  syncOffline: (issues) => api.post('/issues/sync', { issues })
};

export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getHeatmap: (params) => api.get(`/analytics/heatmap?${new URLSearchParams(params)}`),
  getAuthorities: () => api.get('/analytics/authorities'),
  getChronicZones: () => api.get('/analytics/chronic-zones'),
  exportData: (format) => api.get(`/analytics/export?format=${format}`)
};

export default api;
