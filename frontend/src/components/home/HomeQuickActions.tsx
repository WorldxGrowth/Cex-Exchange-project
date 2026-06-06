import { useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft, ArrowUpRight, Repeat, Users,
  Gift, Star, HelpCircle, LayoutGrid
} from 'lucide-react';

export default function HomeQuickActions() {
  const navigate = useNavigate();

  const actions = [
    { icon: ArrowDownLeft, label: 'Deposit',  action: () => navigate('/deposit'),  color: '#0ecb81' },
    { icon: ArrowUpRight,  label: 'Withdraw', action: () => navigate('/withdraw'), color: '#f6465d' },
    { icon: Repeat,        label: 'Transfer', action: () => navigate('/transfer'), color: '#1890ff' },
    { icon: Users,         label: 'Referral', action: () => navigate('/referral'), color: '#f0b90b' },
    { icon: Gift,          label: 'Listing',  action: () => navigate('/listing'),  color: '#722ed1' },
    { icon: Star,          label: 'VIP',      action: () => alert('Coming soon'),  color: '#f0b90b' },
    { icon: HelpCircle,    label: 'Support',  action: () => navigate('/support'),  color: '#13c2c2' },
    { icon: LayoutGrid,    label: 'More',     action: () => navigate('/more'),     color: '#848e9c' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 12, marginTop: 20, padding: '0 20px' }}>
      {actions.map(({ icon: Icon, label, action, color }) => (
        <button key={label} onClick={action} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7
        }}>
          <div style={{ width: 54, height: 54, borderRadius: 16,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={22} color={color} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 500 }}>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
