import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useStore } from './store/useStore';

import ForgotPassword from './pages/auth/ForgotPassword';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import MainLayout from './components/layout/MainLayout';
import Home from './pages/home/Home';
import Markets from './pages/markets/Markets';
import Trade from './pages/trade/Trade';
import Assets from './pages/assets/Assets';
import Deposit from './pages/assets/Deposit';
import Withdraw from './pages/assets/Withdraw';
import Profile from './pages/profile/Profile';
import Referral from './pages/referral/Referral';
import KYC from './pages/kyc/KYC';
import ListingApply from './pages/listing/ListingApply';
import ListingDetail from './pages/listing/ListingDetail';
import TokenDetail  from './pages/assets/TokenDetail';
import Security from './pages/security/Security';
import EditProfile from './pages/profile/EditProfile';
import TwoFA from './pages/security/TwoFA';
import Support from './pages/support/Support';
import Transfer from './pages/transfer/Transfer';
import Scanner from './pages/scanner/Scanner';
import GoogleSuccess from './pages/auth/GoogleSuccess';
import Chart from './pages/chart/Chart';
import Orders from './pages/orders/Orders';
import DepositHistory from './pages/assets/DepositHistory';
import DepositDetail from './pages/assets/DepositDetail';
import WithdrawDetail from './pages/assets/WithdrawDetail';
import Futures from './pages/futures/Futures';
import FuturesHistory from './pages/futures/FuturesHistory';
import FuturesOrderDetail from './pages/futures/FuturesOrderDetail';
import Landing from './pages/landing/Landing';
import CmsPage from './pages/cms/CmsPage';
import Notifications from './pages/notifications/Notifications';
import More from './pages/home/More';

const hasValidToken = () => {
  try {
    const raw = localStorage.getItem('vdexchange-store');
    if (!raw) return false;
    return !!JSON.parse(raw)?.state?.token;
  } catch { return false; }
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const isLoggedIn = useStore((s) => s.isLoggedIn);
  return (isLoggedIn || hasValidToken()) ? <>{children}</> : <Navigate to="/login" />;
};

// Loading spinner component
export default function App() {
  const { theme } = useStore();

  useEffect(() => { document.documentElement.className = theme; }, [theme]);

  // Hide the instant index.html preloader once React has mounted and is ready to paint
  useEffect(() => {
    (window as any).__hidePreloader?.();
  }, []);

  return (
    <div className={theme}>
      <BrowserRouter>
        <Routes>
          {/* ── Public routes ─── */}
          <Route path="/"            element={<Landing />} />
          <Route path="/pages/:slug" element={<CmsPage />} />
          <Route path="/login"       element={<Login />} />
          <Route path="/register"    element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/google/success" element={<GoogleSuccess />} />
          <Route path="/scanner"     element={<PrivateRoute><Scanner /></PrivateRoute>} />

          {/* ── Private routes ─── */}
          <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            <Route path="home"             element={<Home />} />
            <Route path="markets"          element={<Markets />} />
            <Route path="trade"            element={<Trade />} />
            <Route path="trade/:symbol"    element={<Trade />} />
            <Route path="assets"           element={<Assets />} />
            <Route path="deposit"          element={<Deposit />} />
            <Route path="withdraw"         element={<Withdraw />} />
            <Route path="transfer"         element={<Transfer />} />
            <Route path="profile"          element={<Profile />} />
            <Route path="referral"         element={<Referral />} />
            <Route path="kyc"              element={<KYC />} />
            <Route path="listing"          element={<ListingApply />} />
            <Route path="listing/:symbol"   element={<ListingDetail />} />
            <Route path="token/:symbol"     element={<TokenDetail />} />
            <Route path="security"         element={<Security />} />
            <Route path="edit-profile"     element={<EditProfile />} />
            <Route path="2fa"              element={<TwoFA />} />
            <Route path="chart/:symbol"    element={<Chart />} />
            <Route path="orders"           element={<Orders />} />
            <Route path="futures"          element={<Futures />} />
            <Route path="futures/:symbol"  element={<Futures />} />
            <Route path="futures-history"  element={<FuturesHistory />} />
            <Route path="futures-order/:id" element={<FuturesOrderDetail />} />
            <Route path="deposit-history"  element={<DepositHistory />} />
            <Route path="deposit-detail/:id" element={<DepositDetail />} />
            <Route path="withdraw-detail/:id" element={<WithdrawDetail />} />
            <Route path="support"          element={<Support />} />
            <Route path="notifications"    element={<Notifications />} />
            <Route path="more"           element={<More />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style: { background: 'var(--color-surface)', color: 'var(--color-text)',
                 border: '1px solid var(--color-border)' }
      }} />
    </div>
  );
}
