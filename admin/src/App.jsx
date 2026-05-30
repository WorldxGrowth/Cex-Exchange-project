import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import Login from './pages/auth/Login';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/dashboard/Dashboard';
import Users from './pages/users/Users';
import UserDetail from './pages/users/UserDetail';
import KYC from './pages/kyc/KYC';
import Deposits from './pages/deposits/Deposits';
import Withdrawals from './pages/withdrawals/Withdrawals';
import Coins from './pages/coins/Coins';
import Listings from './pages/listings/Listings';
import Scanner from './pages/scanner/Scanner';
import Banners from './pages/banners/Banners';
import Settings from './pages/settings/Settings';
import Bots from './pages/bots/Bots';

const isAuth = () => !!localStorage.getItem('admin_token');
const PrivateRoute = ({ children }) =>
  isAuth() ? children : <Navigate to="/login" />;

export default function App() {
  return (
    <ConfigProvider theme={{
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#f0b90b',
        colorBgBase: '#0b0e11',
        colorBgContainer: '#1e2026',
        colorBgElevated: '#2b2f36',
        borderRadius: 8,
        colorBorderSecondary: '#2b2f36',
      }
    }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <PrivateRoute><MainLayout /></PrivateRoute>
          }>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard"    element={<Dashboard />} />
            <Route path="users"        element={<Users />} />
            <Route path="users/:id"    element={<UserDetail />} />
            <Route path="kyc"          element={<KYC />} />
            <Route path="deposits"     element={<Deposits />} />
            <Route path="withdrawals"  element={<Withdrawals />} />
            <Route path="coins"        element={<Coins />} />
            <Route path="listings"     element={<Listings />} />
            <Route path="scanner"      element={<Scanner />} />
            <Route path="banners"      element={<Banners />} />
            <Route path="settings"     element={<Settings />} />
            <Route path="bots"         element={<Bots />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
