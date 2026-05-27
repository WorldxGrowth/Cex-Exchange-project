import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

// Auto attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto logout on 401
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || err);
  }
);

export const adminAPI = {
  // Auth
  login: (data) => api.post('/admin/login', data),

  // Dashboard
  dashboard: () => api.get('/admin/dashboard'),

  // Users
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUserStatus: (id, data) => api.put(`/admin/users/${id}/status`, data),
  approveKYC: (kycId, data) => api.put(`/admin/kyc/${kycId}`, data),

  // Coins
  getCoins: () => api.get('/admin/coins'),
  addCoin: (data) => api.post('/admin/coins', data),
  updateCoin: (id, data) => api.put(`/admin/coins/${id}`, data),

  // Trading Pairs
  addPair: (data) => api.post('/admin/pairs', data),

  // Withdrawals
  getPendingWithdrawals: () => api.get('/admin/withdrawals/pending'),
  processWithdrawal: (id, data) => api.put(`/admin/withdrawals/${id}`, data),

  // Listings
  getListings: (params) => api.get('/admin/listings', { params }),
  processListing: (id, data) => api.put(`/admin/listings/${id}`, data),

  // Settings
  getSettings: () => api.get('/admin/settings'),
  updateSetting: (key, data) => api.put(`/admin/settings/${key}`, data),

  // Content
  addBanner: (data) => api.post('/admin/banners', data),
  addPopup: (data) => api.post('/admin/popups', data),
  addAnnouncement: (data) => api.post('/admin/announcements', data),

  // Market (public)
  getPairs: () => api.get('/market/pairs'),
};

export default api;
