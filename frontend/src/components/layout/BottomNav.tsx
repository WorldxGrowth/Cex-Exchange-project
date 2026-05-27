import { useNavigate, useLocation } from 'react-router-dom';
import { Home, BarChart2, TrendingUp, Wallet, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

const navItems = [
  { icon: Home,       label: 'Home',    path: '/home',    action: null },
  { icon: BarChart2,  label: 'Markets', path: '/markets', action: null },
  { icon: TrendingUp, label: 'Trade',   path: '/trade',   action: null },
  { icon: Layers,     label: 'Futures', path: '/futures', action: 'soon' },
  { icon: Wallet,     label: 'Assets',  path: '/assets',  action: null },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)',
      display: 'flex', height: '56px'
    }}>
      {navItems.map(({ icon: Icon, label, path, action }) => {
        const active = location.pathname === path ||
          (path === '/trade' && location.pathname.startsWith('/trade'));

        return (
          <button key={path} onClick={() => {
            if (action === 'soon') {
              toast('Futures trading coming soon! 🚀', { icon: '⏳' });
            } else {
              navigate(path);
            }
          }} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer',
            color: active ? 'var(--color-primary)' : 'var(--color-muted)',
            transition: 'color 0.2s', position: 'relative'
          }}>
            <Icon size={19} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{label}</span>
            {action === 'soon' && (
              <span style={{
                position: 'absolute', top: 6, right: '18%',
                fontSize: 8, padding: '1px 4px', borderRadius: 6,
                background: 'var(--color-primary)', color: '#000', fontWeight: 700
              }}>NEW</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
