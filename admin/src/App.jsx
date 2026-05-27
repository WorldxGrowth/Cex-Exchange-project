import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import Login from './pages/auth/Login';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/dashboard/Dashboard';
import Users from './pages/users/Users';
import Coins from './pages/coins/Coins';
import Withdrawals from './pages/withdrawals/Withdrawals';
import Listings from './pages/listings/Listings';
import Settings from './pages/settings/Settings';

const isAuth = () => !!localStorage.getItem('admin_token');

const PrivateRoute = ({ children }) =>
  isAuth() ? children : <Navigate to="/login" />;

export default function App() {
  return (
    <ConfigProvider theme={{
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#1890ff',
        borderRadius: 8,
      }
    }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <PrivateRoute><MainLayout /></PrivateRoute>
          }>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard"   element={<Dashboard />} />
            <Route path="users"       element={<Users />} />
            <Route path="coins"       element={<Coins />} />
            <Route path="withdrawals" element={<Withdrawals />} />
            <Route path="listings"    element={<Listings />} />
            <Route path="settings"    element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
