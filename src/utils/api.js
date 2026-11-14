const API_BASE = '/api';

export function getAuthToken() {
  try {
    return localStorage.getItem('pathian_ram_token');
  } catch (e) {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem('pathian_ram_token', token);
    } else {
      localStorage.removeItem('pathian_ram_token');
    }
  } catch (e) {}
}

export function getAuthUser() {
  try {
    const token = getAuthToken();
    if (!token) return null;
    const user = localStorage.getItem('pathian_ram_user');
    return user ? JSON.parse(user) : null;
  } catch (e) {
    return null;
  }
}

export function setAuthUser(user) {
  try {
    if (user) {
      localStorage.setItem('pathian_ram_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('pathian_ram_user');
    }
  } catch (e) {}
}

export async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const isAuthEndpoint = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/google');
  if (response.status === 401 && !isAuthEndpoint) {
    setAuthToken(null);
    setAuthUser(null);
    window.location.href = '/';
    throw new Error('Session expired. Please log in again.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Server error (${response.status})`);
  }

  return data;
}

// API methods
export const api = {
  // Auth
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  googleLogin: (data) => request('/auth/google', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/auth/me'),
  changePassword: (data) => request('/auth/change-password', { method: 'PUT', body: JSON.stringify(data) }),

  // Admin
  getBials: (year) => request(`/admin/bials${year ? `?year=${year}` : ''}`),
  createBial: (data) => request('/admin/bials', { method: 'POST', body: JSON.stringify(data) }),
  updateBial: (id, data) => request(`/admin/bials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBial: (id) => request(`/admin/bials/${id}`, { method: 'DELETE' }),
  getAdminGoogleEmails: () => request('/admin/google-emails'),
  addAdminGoogleEmail: (email) => request('/admin/google-emails', { method: 'POST', body: JSON.stringify({ email }) }),
  deleteAdminGoogleEmail: (id) => request(`/admin/google-emails/${id}`, { method: 'DELETE' }),
  setPrimaryAdminOwner: (email) => request('/admin/primary-owner', { method: 'PUT', body: JSON.stringify({ email }) }),
  getMonthLocks: (year) => request(`/admin/month-locks?year=${year}`),
  toggleMonthLock: (data) => request('/admin/month-locks/toggle', { method: 'POST', body: JSON.stringify(data) }),
  getAdminDashboard: (year, filters = {}) => {
    let query = `/admin/dashboard?year=${year}`;
    if (filters.bial_id && filters.bial_id !== 'all') query += `&bial_id=${filters.bial_id}`;
    if (filters.month && filters.month !== 'all') query += `&month=${filters.month}`;
    return request(query);
  },
  getFinancialYears: () => request('/admin/years'),
  addFinancialYear: (year, setActive = false) => request('/admin/years', { method: 'POST', body: JSON.stringify({ year, set_active: setActive }) }),
  setActiveFinancialYear: (year) => request('/admin/years/active', { method: 'PUT', body: JSON.stringify({ year }) }),
  deleteFinancialYear: (year) => request(`/admin/years/${year}`, { method: 'DELETE' }),
  getOverallMemberContributions: (year) => request(`/admin/overall-member-contributions?year=${year}`),
  getAllMembers: (year) => request(`/admin/members/all${year ? `?year=${year}` : ''}`),
  transferMember: (data) => request('/admin/members/transfer', { method: 'POST', body: JSON.stringify(data) }),

  // Members
  getMembers: (bial_id, year) => request(`/members?bial_id=${bial_id}${year ? `&year=${year}` : ''}`),
  addMember: (data) => request('/members', { method: 'POST', body: JSON.stringify(data) }),
  updateMember: (id, data) => request(`/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMember: (id) => request(`/members/${id}`, { method: 'DELETE' }),
  rolloverMembers: (data) => request('/members/rollover', { method: 'POST', body: JSON.stringify(data) }),

  // Tithes
  getTithes: (bial_id, year, month) => request(`/tithes?bial_id=${bial_id}&year=${year}&month=${month}`),
  saveTithe: (data) => request('/tithes/upsert', { method: 'POST', body: JSON.stringify(data) }),
  bulkSaveTithes: (data) => request('/tithes/bulk-upsert', { method: 'POST', body: JSON.stringify(data) }),
  getYearlySummary: (bial_id, year) => request(`/tithes/yearly-summary?bial_id=${bial_id}&year=${year}`),
  getMemberHistory: (member_id, year) => request(`/tithes/member-history?member_id=${member_id}&year=${year}`),

  // Tithe Columns
  getColumns: () => request('/columns'),
  createColumn: (data) => request('/columns', { method: 'POST', body: JSON.stringify(data) }),
  updateColumn: (id, data) => request(`/columns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteColumn: (id) => request(`/columns/${id}`, { method: 'DELETE' }),
  reorderColumns: (orders) => request('/columns/reorder', { method: 'PUT', body: JSON.stringify({ orders }) }),

  // Backup & Restore
  triggerBackupNow: async () => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/backup/now`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Backup creation failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pathian_ram_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
  getBackupsList: () => request('/backup/list'),
  restoreBackup: async (file) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('backup_file', file);
    const res = await fetch(`${API_BASE}/backup/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Restore failed');
    return data;
  }
};
