import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../../services/api';
import { ChevronLeft, ChevronRight, Shield, Smartphone, Mail, Key, Clock, Trash2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

// Change Password Sub-page
const ChangePassword = ({ onBack }: any) => {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [show, setShow] = useState(false);
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
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally { setLoading(false); }
  };

  const inp: any = {
    width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>Change Password</span>
      </div>
      <div style={{ padding: '20px 16px' }}>
        {['current_password', 'new_password', 'confirm_password'].map((key, i) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>
              {key === 'current_password' ? 'Current Password' : key === 'new_password' ? 'New Password' : 'Confirm New Password'}
            </div>
            <div style={{ position: 'relative' }}>
              <input type={show ? 'text' : 'password'} value={(form as any)[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
                placeholder="••••••••" style={inp} />
              {i === 0 && (
                <button onClick={() => setShow(!show)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)'
                }}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              )}
            </div>
          </div>
        ))}
        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', padding: '13px', borderRadius: 10, border: 'none',
          background: 'var(--color-primary)', color: '#000', fontWeight: 700,
          cursor: 'pointer', fontSize: 15, marginTop: 8
        }}>
          {loading ? 'Changing...' : 'Change Password'}
        </button>
      </div>
    </div>
  );
};

// Login History Sub-page
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
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>Login History</span>
      </div>
      <div>
        {history.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>No history</div>
          : history.map((h: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                   padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <div style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500 }}>
                  {h.ip_address} · {h.device_type}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                  {new Date(h.created_at).toLocaleString()}
                </div>
                {h.location && <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{h.location}</div>}
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                             background: h.status === 'success' ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)',
                             color: h.status === 'success' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {h.status}
              </span>
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
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    userAPI.getProfile().then((res: any) => {
      setProfile(res.data);
      setTwoFAEnabled(res.data?.two_fa_enabled || false);
    });
  }, []);

  if (subPage === 'password') return <ChangePassword onBack={() => setSubPage(null)} />;
  if (subPage === 'history') return <LoginHistory onBack={() => setSubPage(null)} />;

  const menuItems = [
    { icon: Key, label: 'Login Password', sub: 'Change your login password', action: () => setSubPage('password'), color: '#1890ff' },
    { icon: Mail, label: 'Email', sub: profile?.email || 'Not set', action: () => toast('Email change coming soon'), color: '#0ecb81', badge: profile?.email_verified ? 'Verified' : 'Unverified', badgeColor: profile?.email_verified ? 'var(--color-success)' : 'var(--color-danger)' },
    { icon: Smartphone, label: 'Phone Number', sub: profile?.phone || 'Not linked', action: () => toast('Phone link coming soon'), color: '#f0b90b' },
    { icon: Shield, label: 'Google Authenticator', sub: '2FA extra security', action: () => toast('2FA setup coming soon'), color: '#722ed1', toggle: true, toggleValue: twoFAEnabled, toggleChange: () => { setTwoFAEnabled(!twoFAEnabled); toast(twoFAEnabled ? '2FA disabled' : '2FA enabled (setup required)'); } },
    { icon: Clock, label: 'Login History', sub: 'View recent logins', action: () => setSubPage('history'), color: '#13c2c2' },
    { icon: Trash2, label: 'Delete Account', sub: 'Permanently delete account', action: () => toast.error('Contact support to delete account'), color: '#f6465d' },
  ];

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>Security</span>
      </div>

      <div style={{ background: 'var(--color-surface)', marginTop: 12,
                    borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
        {menuItems.map(({ icon: Icon, label, sub, action, color, badge, badgeColor, toggle, toggleValue, toggleChange }, i) => (
          <div key={label} onClick={toggle ? undefined : action}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                     cursor: toggle ? 'default' : 'pointer',
                     borderBottom: i < menuItems.length - 1 ? '1px solid var(--color-border)' : 'none' }}
            onMouseEnter={e => !toggle && (e.currentTarget.style.background = 'var(--color-surface2)')}
            onMouseLeave={e => !toggle && (e.currentTarget.style.background = 'transparent')}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '20',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={20} color={color} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 1 }}>
                {sub}
                {badge && (
                  <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 10, fontSize: 10,
                                  background: (badgeColor || '') + '20', color: badgeColor }}>
                    {badge}
                  </span>
                )}
              </div>
            </div>
            {toggle
              ? <div onClick={toggleChange} style={{
                  width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                  background: toggleValue ? 'var(--color-success)' : 'var(--color-surface2)',
                  border: `1px solid ${toggleValue ? 'var(--color-success)' : 'var(--color-border)'}`,
                  position: 'relative', transition: 'all 0.2s', flexShrink: 0
                }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff',
                                position: 'absolute', top: 2,
                                left: toggleValue ? 22 : 2, transition: 'left 0.2s' }} />
                </div>
              : <ChevronRight size={18} color="var(--color-muted)" />
            }
          </div>
        ))}
      </div>
    </div>
  );
}
