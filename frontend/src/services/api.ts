import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 60000,
});

const getToken = () => {
  try {
    const raw = localStorage.getItem('vdexchange-store');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.token || null;
  } catch { return null; }
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || '';
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        const token = getToken();
        if (token) {
          localStorage.removeItem('vdexchange-store');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err.response?.data || err);
  }
);

export const authAPI = {
  register:     (d: any) => api.post('/auth/register', d),
  login:        (d: any) => api.post('/auth/login', d),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword:  (d: any) => api.post('/auth/reset-password', d),
  logout:       ()       => api.post('/auth/logout'),
  me:           ()       => api.get('/auth/me'),
};

export const marketAPI = {
  getCoins:     ()                             => api.get('/market/coins'),
  getPairs:     ()                             => api.get('/market/pairs'),
  getTicker:    (symbol: string)               => api.get(`/market/ticker/${symbol}`),
  getOrderBook: (symbol: string, limit = 20)   => api.get(`/market/orderbook/${symbol}?limit=${limit}`),
  getTrades:    (symbol: string)               => api.get(`/market/trades/${symbol}`),
  getKlines:    (symbol: string, interval = '1h', limit = 200) =>
    api.get(`/market/klines/${symbol}?interval=${interval}&limit=${limit}`),
};

export const walletAPI = {
  getBalances:         ()            => api.get('/wallet/balances'),
  getDepositAddress:   (coin: string, network = 'BSC') => api.get(`/deposit/address?coin=${coin}&network=${network}`),
  getDeposits:         ()            => api.get('/wallet/deposits'),
  getDepositHistory:   (params?: any) => api.get('/deposit/history', { params }),
  getWithdrawInfo:     (coin: string) => api.get(`/withdrawal/info?coin=${coin}`),
  requestWithdrawal:   (d: any)      => api.post('/withdrawal/request', d),
  getWithdrawalHistory: (params?: any) => api.get('/withdrawal/history', { params }),
  withdraw:            (d: any)      => api.post('/wallet/withdraw', d),
  getWithdrawals:      ()            => api.get('/wallet/withdrawals'),
  sendWithdrawalOTP:   ()            => api.post('/withdrawal/send-otp', {}),
  getWithdrawHistory:  (params?: any) => api.get('/withdrawal/history', { params }),
  transfer:            (d: any)      => api.post('/wallet/transfer', d),
  getTransactions:     ()            => api.get('/wallet/transactions'),
};

export const orderAPI = {
  place:      (d: any)       => api.post('/orders/place', d),
  cancel:     (id: string)   => api.delete(`/orders/${id}`),
  getOpen:    (symbol?: string) => api.get('/orders/open' + (symbol ? `?symbol=${symbol}` : '')),
  getHistory: (symbol?: string) => api.get('/orders/history' + (symbol ? `?symbol=${symbol}` : '')),
  getTrades:  ()             => api.get('/orders/trades'),
};

export const userAPI = {
  getProfile:       ()          => api.get('/user/profile'),
  updateProfile:    (d: any)    => api.put('/user/profile', d),
  uploadAvatar:     (d: any)    => api.post('/user/avatar', d),
  changePassword:   (d: any)    => api.post('/user/change-password', d),
  setAntiPhishCode: (d: any)    => api.post('/user/anti-phish-code', d),
  getLoginHistory:  ()          => api.get('/user/login-history'),
  getSessions:      ()          => api.get('/user/sessions'),
  revokeSession:    (id: string) => api.delete(`/user/sessions/${id}`),
  submitKYC:        (d: any)    => api.post('/user/kyc/submit', d),
  getKYCStatus:     ()          => api.get('/user/kyc/status'),
};

export const notifAPI = {
  getAll:           ()                => api.get('/notifications'),
  markRead:         (id: string)      => api.put(`/notifications/${id}/read`),
  getBanners:       (platform = 'web') => api.get(`/notifications/banners?platform=${platform}`),
  getPopups:        (platform = 'web') => api.get(`/notifications/popups?platform=${platform}`),
  getAnnouncements: ()                => api.get('/notifications/announcements'),
};

export const transferAPI = {
  between:  (d: any)        => api.post('/transfer/accounts', d),
  internal: (d: any)        => api.post('/transfer/internal', d),
  lookup:   (identifier: string) => api.get(`/transfer/lookup?identifier=${identifier}`),
  history:  ()              => api.get('/transfer/history'),
};

export const referralAPI = {
  getInfo:        () => api.get('/referral/info'),
  getList:        () => api.get('/referral/list'),
  getCommissions: () => api.get('/referral/commissions'),
};

export const listingAPI = {
  getPackages:   () => api.get('/listing/packages'),
  apply:         (d: any) => api.post('/listing/apply', d),
  getMyListings: () => api.get('/listing/my'),
};

export const twoFAAPI = {
  getStatus:   ()                                    => api.get('/2fa/status'),
  setup:       ()                                    => api.post('/2fa/setup'),
  verify:      (token: string)                       => api.post('/2fa/verify', { token }),
  disable:     (token: string)                       => api.post('/2fa/disable', { token }),
  loginVerify: (temp_token: string, otp_token: string) =>
    api.post('/2fa/login-verify', { temp_token, otp_token }),
};

export const otpAPI = {
  check:  (identifier: string)                          => api.post('/auth/check', { identifier }),
  send:   (identifier: string, type = 'login')          => api.post('/auth/otp/send', { identifier, type }),
  verify: (identifier: string, code: string, type = 'login') =>
    api.post('/auth/otp/verify', { identifier, code, type }),
};

export default api;
