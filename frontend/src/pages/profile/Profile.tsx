import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { userAPI, authAPI } from '../../services/api';
import {
  Shield, Key, Clock, LogOut, ChevronRight,
  User, Bell, Globe, Moon, Sun, Copy, Gift, Users
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Profile() {
  const navigate = useNavigate();
  const { user, theme, toggleTheme, logout } = useStore();
  const [profile, setProfile] = useState<any>(null);
  const [kycStatus, setKycStatus] = useState<any>(null);

  useEffect(() => {
    userAPI.getProfile().then((res: any) => setProfile(res.data)).catch(() => {});
    userAPI.getKYCStatus().then((res: any) => setKycStatus(res.data)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch {}
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      section: 'Account',
      items: [
        { icon: Shield, label: 'Security', sub: '2FA, Password', action: () => navigate('/security') },
        { icon: Key, label: 'KYC Verification',
          sub: profile?.kyc_level > 0 ? `Level ${profile?.kyc_level} Verified` : 'Unverified',
          badge: profile?.kyc_level === 0 ? 'Verify' : undefined,
          action: () => navigate('/kyc') },
        { icon: Clock, label: 'Login History', sub: 'View recent logins', action: () => navigate('/security') },
      ]
    },
    {
      section: 'Features',
      items: [
        { icon: Users, label: 'Referral Program',
          sub: `Code: ${profile?.referral_code || '---'}`,
          action: () => navigate('/referral') },
        { icon: Gift, label: 'List Your Token',
          sub: 'Starting ₹50,000', action: () => navigate('/listing') },
      ]
    },
    {
      section: 'Preferences',
      items: [
        { icon: theme === 'dark' ? Moon : Sun,
          label: 'Theme', sub: theme === 'dark' ? 'Dark Mode' : 'Light Mode',
          action: toggleTheme },
        { icon: Globe, label: 'Language', sub: 'English', action: () => navigate('/security') },
        { icon: Bell, label: 'Notifications', sub: 'All enabled', action: () => navigate('/security') },
      ]
    }
  ];

  return (
    <div style={{ paddingBottom: 20 }}>

      {/* Profile Header */}
      <div style={{ background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '24px 16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%',
                        background: 'var(--color-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24, fontWeight: 700, color: '#000' }}>
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
              {user?.email?.split('@')[0] || 'User'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
              UID: {profile?.uid || '---'}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11,
                             background: 'rgba(240,185,11,0.15)', color: 'var(--color-primary)',
                             fontWeight: 600 }}>
                VIP {profile?.vip_level || 0}
              </span>
              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11,
                             background: profile?.kyc_level > 0
                               ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)',
                             color: profile?.kyc_level > 0
                               ? 'var(--color-success)' : 'var(--color-danger)',
                             fontWeight: 600 }}>
                {profile?.kyc_level > 0 ? `KYC Level ${profile?.kyc_level}` : 'Unverified'}
              </span>
            </div>
          </div>
        </div>

        {/* Edit Profile Button */}
        <button onClick={() => navigate('/edit-profile')} style={{
          width: '100%', padding: '10px', borderRadius: 10, marginBottom: 12,
          border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
          color: 'var(--color-text)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
        }}>
          ✏️ Edit Profile
        </button>

        {/* Referral Code */}
        {profile?.referral_code && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 10,
                        background: 'var(--color-surface2)', cursor: 'pointer' }}
               onClick={() => {
                 navigator.clipboard.writeText(profile.referral_code);
                 toast.success('Referral code copied!');
               }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Referral Code</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-primary)', marginTop: 2 }}>
                {profile.referral_code}
              </div>
            </div>
            <Copy size={16} color="var(--color-muted)" />
          </div>
        )}
      </div>

      {/* Menu Items */}
      {menuItems.map(section => (
        <div key={section.section} style={{ marginTop: 16 }}>
          <div style={{ padding: '0 16px 8px', fontSize: 12, color: 'var(--color-muted)',
                        fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {section.section}
          </div>
          <div style={{ background: 'var(--color-surface)',
                        borderTop: '1px solid var(--color-border)',
                        borderBottom: '1px solid var(--color-border)' }}>
            {section.items.map(({ icon: Icon, label, sub, badge, action }, i) => (
              <div key={label} onClick={action}
                style={{ display: 'flex', alignItems: 'center', gap: 12,
                         padding: '14px 16px', cursor: 'pointer',
                         borderBottom: i < section.items.length - 1
                           ? '1px solid var(--color-border)' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ width: 36, height: 36, borderRadius: 10,
                              background: 'var(--color-surface2)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color="var(--color-muted)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 1 }}>{sub}</div>
                </div>
                {badge && (
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11,
                                 background: 'rgba(240,185,11,0.15)',
                                 color: 'var(--color-primary)', fontWeight: 600 }}>
                    {badge}
                  </span>
                )}
                <ChevronRight size={16} color="var(--color-muted)" />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Logout */}
      <div style={{ padding: '16px' }}>
        <button onClick={handleLogout} style={{
          width: '100%', padding: '14px', borderRadius: 12,
          background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)',
          cursor: 'pointer', color: 'var(--color-danger)', fontSize: 15,
          fontWeight: 700, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8
        }}>
          <LogOut size={18} /> Logout
        </button>
      </div>

      {/* Version */}
      <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 12, paddingBottom: 8 }}>
        VDExchange v1.0.0
      </div>
    </div>
  );
}
