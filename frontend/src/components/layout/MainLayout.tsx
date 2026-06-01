import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';

export default function MainLayout() {
  const location = useLocation();
  const path = location.pathname;

  // Pages jahan header NAHI dikhana
  const hideHeader =
    path.startsWith('/trade')      ||
    path.startsWith('/profile')    ||
    path.startsWith('/edit-profile') ||
    path.startsWith('/security')   ||
    path.startsWith('/kyc')        ||
    path.startsWith('/referral')   ||
    path.startsWith('/2fa')        ||
    path.startsWith('/deposit')    ||
    path.startsWith('/withdraw')   ||
    path.startsWith('/transfer')   ||
    path.startsWith('/assets')     ||
    path.startsWith('/orders')     ||
    path.startsWith('/futures')    ||
    path.startsWith('/listing')    ||
    path.startsWith('/support')    ||
    path.startsWith('/notifications') ||
    path.startsWith('/chart')      ||
    path.startsWith('/deposit-history') ||
    path.startsWith('/deposit-detail') ||
    path.startsWith('/more');

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      {!hideHeader && <Header />}
      <main style={{
        paddingBottom: '60px',
        paddingTop: hideHeader ? '0px' : '56px'
      }}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
