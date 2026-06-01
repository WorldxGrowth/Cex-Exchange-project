import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search,
  ArrowDownLeft, ArrowUpRight, Repeat, Users, Gift,
  Star, HelpCircle, Shield, FileText, Bell, Settings } from 'lucide-react';

export default function More() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const sections = [
    {
      title: 'Assets',
      items: [
        { icon: ArrowDownLeft, label: 'Deposit',   color: '#0ecb81', action: () => navigate('/deposit') },
        { icon: ArrowUpRight,  label: 'Withdraw',  color: '#f6465d', action: () => navigate('/withdraw') },
        { icon: Repeat,        label: 'Transfer',  color: '#1890ff', action: () => navigate('/transfer') },
        { icon: FileText,      label: 'History',   color: '#848e9c', action: () => navigate('/deposit-history') },
      ]
    },
    {
      title: 'Services',
      items: [
        { icon: Users,    label: 'Referral', color: '#f0b90b', action: () => navigate('/referral') },
        { icon: Star,     label: 'VIP',      color: '#f0b90b', action: () => { alert('Coming soon'); } },
        { icon: Gift,     label: 'Listing',  color: '#722ed1', action: () => navigate('/listing') },
        { icon: Shield,   label: 'KYC',      color: '#0ecb81', action: () => navigate('/kyc') },
      ]
    },
    {
      title: 'Support',
      items: [
        { icon: HelpCircle, label: 'Help',          color: '#13c2c2', action: () => navigate('/support') },
        { icon: Bell,       label: 'Notifications', color: '#1890ff', action: () => navigate('/notifications') },
        { icon: Settings,   label: 'Security',      color: '#848e9c', action: () => navigate('/security') },
      ]
    }
  ];

  const allItems = sections.flatMap(s => s.items);
  const filtered = search
    ? allItems.filter(i => i.label.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
                    height: 56, background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Features</span>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--color-surface2)', borderRadius: 14,
                      padding: '12px 16px', marginBottom: 20,
                      border: '1px solid var(--color-border)' }}>
          <Search size={16} color="var(--color-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search features"
            style={{ flex: 1, background: 'none', border: 'none',
                     color: 'var(--color-text)', fontSize: 15, outline: 'none' }} />
        </div>

        {/* Search results */}
        {filtered ? (
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)',
                          marginBottom: 12 }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {filtered.map(item => (
                <QuickBtn key={item.label} {...item} />
              ))}
            </div>
          </div>
        ) : (
          sections.map(section => (
            <div key={section.title} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16,
                            color: 'var(--color-text)' }}>
                {section.title}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {section.items.map(item => (
                  <QuickBtn key={item.label} {...item} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const QuickBtn = ({ icon: Icon, label, color, action }: any) => (
  <button onClick={action} style={{
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
  }}>
    <div style={{
      width: 56, height: 56, borderRadius: 16,
      background: 'var(--color-surface2)',
      border: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <Icon size={24} color={color} />
    </div>
    <span style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 500 }}>
      {label}
    </span>
  </button>
);
