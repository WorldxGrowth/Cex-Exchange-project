import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../../services/api';
import { ChevronLeft, ChevronRight, Shield, Key, Smartphone,
         Lock, Clock, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

// Change Password Sub-Page
const ChangePassword = ({ onBack }: any) => {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.current_password || !form.new_password) { toast.error('Fill all fields'); return; }
    if (form.new_password !== form.confirm_password) { toast.error('Passwords do not match'); return; }
    if (form.new_password.length < 8) { toast.error('Min 8 characters'); return; }
    setLoading(true);
    try {
      await userAPI.changePassword({ current_password: form.current_password, new_password: form.new_password });
      toast.success('Password changed!');
      onBack();
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const inp: any = { width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>Change Password</span>
      </div>

      {[
        { key: 'current_password', label: 'Current Password' },
        { key: 'new_password', label: 'New Password (min 8 chars)' },
        { key: 'confirm_password', label: 'Confirm New Password' },
      ].map(f => (
        <div key={f.key} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>{f.label}</div>
          <input type="password" value={(form as any)[f.key]}
            onChange={e => setForm({ ...form, [f.key]: e.target.value })}
            style={inp} />
        </div>
      ))}

      <button onClick={handleSubmit} disabled={loading} style={{
        width: '100%', padding: 14, borderRadius: 12, border: 'none', marginTop: 8,
        background: loading ? 'var(--color-border)' : 'var(--color-primary)',
        color: '#000', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
      }}>
        {loading ? 'Changing...' : 'Change Password'}
      </button>
    </div>
  );
};

// Login History Sub-Page
const LoginHistory = ({ onBack }: any) => {
  const [history, setHistory] = useState<any[]>([]);
  useEffect(() => { userAPI.getLoginHistory().then((res: any) => setHistory(res.data || [])); }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>Login History</span>
      </div>
      <div style={{ padding: 16 }}>
        {history.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>No history</div>
          : history.map((h: any, i: number) => (
            <div key={i} style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 8,
                                   background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: h.status === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                               fontSize: 13 }}>
                  {h.status === 'success' ? '✅ Success' : '❌ Failed'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  {new Date(h.created_at).toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                IP: {h.ip_address} • {h.device_type}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
};

// Main Security Page
export default function Security() {
  const navigate = useNavigate();
  const [subPage, setSubPage] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  useEffect(() => {
    userAPI.getProfile().then((res: any) => {
      setProfile(res.data);
      setTwoFAEnabled(res.data?.two_fa_enabled || false);
    });
  }, []);

  if (subPage === 'password') return <ChangePassword onBack={() => setSubPage(null)} />;
  if (subPage === 'history') return <LoginHistory onBack={() => setSubPage(null)} />;

  const items = [
    {
      icon: Key, label: 'Login Password', sub: 'Change your login password',
      action: () => setSubPage('password'), color: '#1890ff'
    },
    {
      icon: Smartphone, label: 'Phone Number',
      sub: profile?.phone ? `Linked: ${profile.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}` : 'Not linked',
      action: () => toast('Coming soon'), color: '#0ecb81'
    },
    {
      icon: Shield, label: 'Google Authenticator',
      sub: twoFAEnabled ? 'Enabled ✅' : 'Not enabled',
      toggle: true, toggled: twoFAEnabled,
      onToggle: () => navigate('/2fa'),
      color: '#f0b90b'
    },
    {
      icon: Lock, label: 'Fund Password',
      sub: profile?.fund_password ? 'Set ✅' : 'Not set - secure your withdrawals',
      action: () => toast('Coming soon'), color: '#722ed1'
    },
    {
      icon: Clock, label: 'Login History',
      sub: 'View recent login activity',
      action: () => setSubPage('history'), color: '#13c2c2'
    },
    {
      icon: Trash2, label: 'Delete Account',
      sub: 'Permanently delete your account',
      action: () => {
        if (window.confirm('Are you sure? This cannot be undone!')) {
          toast.error('Please contact support to delete account');
        }
      }, color: '#f6465d', danger: true
    },
  ];

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>Security</span>
      </div>

      <div style={{ padding: 16 }}>
        {/* Security Score */}
        <div style={{ padding: '16px', borderRadius: 12, marginBottom: 20,
                      background: 'linear-gradient(135deg, rgba(24,144,255,0.1), rgba(114,46,209,0.1))',
                      border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>Security Level</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: twoFAEnabled ? 'var(--color-success)' : 'var(--color-warning)' }}>
            {twoFAEnabled ? 'High 🔒' : 'Medium ⚠️'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
            {twoFAEnabled ? 'Your account is well protected' : 'Enable 2FA to increase security'}
          </div>
        </div>

        {/* Items */}
        <div style={{ background: 'var(--color-surface)', borderRadius: 12,
                      border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          {items.map(({ icon: Icon, label, sub, action, toggle, toggled, onToggle, color, danger }, i) => (
            <div key={label} onClick={action}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                       cursor: 'pointer', borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: (color || '#1890ff') + '20',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={danger ? 'var(--color-danger)' : (color || '#1890ff')} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: danger ? 'var(--color-danger)' : 'var(--color-text)',
                               fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 1 }}>{sub}</div>
              </div>
              {toggle ? (
                <button onClick={e => { e.stopPropagation(); onToggle?.(); }} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: toggled ? 'var(--color-success)' : 'var(--color-muted)'
                }}>
                  {toggled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              ) : (
                <ChevronRight size={16} color="var(--color-muted)" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
