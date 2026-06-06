import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
  updateUserVip: (id, data) => api.put(`/admin/users/${id}/vip`, data),
  getUserDetail: (id) => api.get(`/admin/users/${id}`),
  getUserBalances: (id) => api.get(`/admin/users/${id}/balances`),
  getUserDeposits: (id) => api.get(`/admin/users/${id}/deposits`),
  getUserWithdrawals: (id) => api.get(`/admin/users/${id}/withdrawals`),
  getUserLedger: (id) => api.get(`/admin/users/${id}/ledger`),
  adjustBalance: (userId, data) => api.post(`/admin/users/${userId}/balance`, data),

  // KYC
  getKYCList: (params) => api.get('/admin/kyc', { params }),
  approveKYC: (kycId, data) => api.put(`/admin/kyc/${kycId}`, data),

  // Coins
  getCoins: () => api.get('/admin/coins'),
  addCoin: (data) => api.post('/admin/coins', data),
  updateCoin: (id, data) => api.put(`/admin/coins/${id}`, data),

  // Trading Pairs
  getPairs: () => api.get('/admin/pairs'),

  // OrderBook Management
  getOrderBook:      (params) => api.get('/admin/orderbook', { params }),
  createOrders:      (data)   => api.post('/admin/orderbook', data),
  updateOrder:       (id, data) => api.put(`/admin/orderbook/${id}`, data),
  deleteOrder:       (id)     => api.delete(`/admin/orderbook/${id}`),
  cancelAllOrders:   (data)   => api.post('/admin/orderbook/cancel-all', data),
  addPair: (data) => api.post('/admin/pairs', data),
  updatePair: (id, data) => api.put(`/admin/pairs/${id}`, data),

  // Fee Rules
  getFeeRules: (params) => api.get('/admin/fee-rules', { params }),
  addFeeRule: (data) => api.post('/admin/fee-rules', data),
  updateFeeRule: (id, data) => api.put(`/admin/fee-rules/${id}`, data),
  deleteFeeRule: (id) => api.delete(`/admin/fee-rules/${id}`),

  // VIP Levels
  getVipLevels: () => api.get('/admin/vip-levels'),
  updateVipLevel: (level, data) => api.put(`/admin/vip-levels/${level}`, data),

  // Reports
  getTreasuryReport: (params) => api.get('/admin/reports/treasury', { params }),
  getVolumeReport: (params) => api.get('/admin/reports/volume', { params }),

  // Binance Credentials
  getBinanceCreds: () => api.get('/admin/binance-credentials'),
  updateBinanceCred: (id, data) => api.put(`/admin/binance-credentials/${id}`, data),

  // Withdrawals
  getPendingWithdrawals: () => api.get('/admin/withdrawals/pending'),
  getWithdrawals: (params) => api.get('/admin/withdrawals', { params }),
  processWithdrawal: (id, data) => api.put(`/admin/withdrawals/${id}`, data),

  // Deposits
  getDeposits: (params) => api.get('/admin/deposits', { params }),

  // Listings
  getListings: (params) => api.get('/admin/listings', { params }),
  processListing: (id, data) => api.put(`/admin/listings/${id}`, data),

  // Settings
  getSettings: () => api.get('/admin/settings'),
  updateSetting: (key, data) => api.put(`/admin/settings/${key}`, data),
  addSetting: (data) => api.post('/admin/settings', data),

  // Content
  addBanner: (data) => api.post('/admin/banners', data),
  addPopup: (data) => api.post('/admin/popups', data),
  addAnnouncement: (data) => api.post('/admin/announcements', data),
  getBanners: () => api.get('/admin/banners'),

  // Scanner
  getScannerState: () => api.get('/admin/scanner/state'),

  // Bot Management
  getBots: () => api.get('/admin/bots'),
  getBotStats: () => api.get('/admin/bots/stats/overview'),
  getBot: (id) => api.get(`/admin/bots/${id}`),
  createBot: (data) => api.post('/admin/bots', data),
  updateBot: (id, data) => api.put(`/admin/bots/${id}`, data),
  toggleBot: (id) => api.post(`/admin/bots/${id}/toggle`),
  cancelBotOrders: (id) => api.post(`/admin/bots/${id}/cancel-orders`),
  resetBotDaily: (id) => api.post(`/admin/bots/${id}/reset-daily`),
  allocateBotBalance: (id, data) => api.post(`/admin/bots/${id}/allocate`, data),
  getBotOrders: (id, params) => api.get(`/admin/bots/${id}/orders`, { params }),
  getBotTrades: (id) => api.get(`/admin/bots/${id}/trades`),
  placeBotManualOrder: (id, data) => api.post(`/admin/bots/${id}/manual-order`, data),
};

export default api;

// New APIs
Object.assign(adminAPI, {
  getWithdrawalSettings: () => api.get('/admin/withdrawal-settings'),
  updateWithdrawalSetting: (id, data) => api.put(`/admin/withdrawal-settings/${id}`, data),
  getNetworks: () => api.get('/admin/networks'),
  updateNetwork: (id, data) => api.put(`/admin/networks/${id}`, data),
  getAnnouncements: () => api.get('/admin/announcements'),
  addAnnouncement: (data) => api.post('/admin/announcements', data),
  updateAnnouncement: (id, data) => api.put(`/admin/announcements/${id}`, data),
  deleteAnnouncement: (id) => api.delete(`/admin/announcements/${id}`),
});

// CMS Admin APIs
Object.assign(adminAPI, {
  getCmsPages:  () => api.get('/admin/cms'),
  getCmsPage:   (id) => api.get(`/admin/cms/${id}`),
  addCmsPage:   (data) => api.post('/admin/cms', data),
  updateCmsPage:(id, data) => api.put(`/admin/cms/${id}`, data),
  deleteCmsPage:(id) => api.delete(`/admin/cms/${id}`),
});
