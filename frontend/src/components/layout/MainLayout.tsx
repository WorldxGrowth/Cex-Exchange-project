import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';

export default function MainLayout() {
  const location = useLocation();
  const isTradeePage = location.pathname.startsWith('/trade');

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      {!isTradeePage && <Header />}
      <main style={{
        paddingBottom: '60px',
        paddingTop: isTradeePage ? '0px' : '56px'
      }}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
