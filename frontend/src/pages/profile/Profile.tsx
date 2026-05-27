import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { userAPI, authAPI } from '../../services/api';
import {
  Shield, LogOut, ChevronRight, Bell, Globe,
  Moon, Sun, Gift, Users, Settings, HelpCircle,
  Copy, Check, Camera
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Profile() {
  const navigate = useNavigate();
  const { user, theme, toggleTheme, logout } = useStore();
  const [profile, setProfile] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [avatar, setAvatar] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    userAPI.getProfile().then((res: any) => {
      setProfile(res.data);
      if (res.data?.avatar) setAvatar(res.data.avatar);
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch {}
    logout();
    navigate('/login');
  };

  const handleCopyUID = () => {
    navigator.clipboard.writeText(profile?.uid || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAvatar(base64);
      userAPI.updateProfile({ avatar: base64 })
        .then(() => toast.success('Avatar updated!'))
        .catch(() => toast.error('Failed'));
    };
    reader.readAsDataURL(file);
  };

  const maskEmail = (email: string) => {
    if (!email) return '---';
    const [name, domain] = email.split('@');
    return name.slice(0, 6) + '****@' + domain;
  };

  const menuSections = [
    {
      items: [
        { icon: Shield, label: 'Security', sub: '2FA, Password, Login history',
          action: () => navigate('/security') },
        { icon: Settings, label: 'Preferences', sub: 'Theme, Language, Notifications',
          action: () => navigate('/security') },
      ]
    },
    {
      items: [
        { icon: Users, label: 'Referral', sub: 'Invite friends, earn commission',
          action: () => navigate('/referral') },
        { icon: Gift, label: 'List Your Token', sub: 'Starting ₹50,000',
          action: () => navigate('/listing'), badge: 'HOT' },
      ]
    },
    {
      items: [
        { icon: HelpCircle, label: 'Help & Support', sub: 'FAQ, Contact us',
          action: () => navigate('/support') },
        { icon: theme === 'dark' ? Sun : Moon,
          label: 'Switch Theme', sub: theme === 'dark' ? 'Dark Mode' : 'Light Mode',
          action: toggleTheme },
      ]
    }
  ];

  return (
    <div style={{ paddingBottom: 30 }}>

      {/* Profile Header Card */}
      <div style={{ background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '20px 16px' }}>

        {/* Avatar + Info Row */}
        <div onClick={() => navigate('/edit-profile')}
          style={{ display: 'flex', alignItems: 'center', gap: 14,
                   cursor: 'pointer', marginBottom: 16 }}>

          {/* Avatar with camera icon */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%',
                          background: avatar ? 'transparent' : 'var(--color-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden' }}>
              {avatar
                ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 26, fontWeight: 700, color: '#000' }}>
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
              }
            </div>
            {/* Camera edit button */}
            <button onClick={e => { e.stopPropagation(); fileRef.current?.click(); }} style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 22, height: 22, borderRadius: '50%',
              background: 'var(--color-surface)', border: '2px solid var(--color-bg)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Camera size={11} color="var(--color-muted)" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={handleAvatarChange} />
          </div>

          {/* User info */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)', marginBottom: 3 }}>
              {maskEmail(user?.email || '')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                UID: {profile?.uid || '---'}
              </span>
              <button onClick={e => { e.stopPropagation(); handleCopyUID(); }} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: copied ? 'var(--color-success)' : 'var(--color-muted)', padding: 0
              }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11,
                             background: profile?.kyc_level > 0
                               ? 'rgba(14,203,129,0.15)' : 'rgba(150,150,150,0.15)',
                             color: profile?.kyc_level > 0 ? 'var(--color-success)' : 'var(--color-muted)',
                             fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%',
                               background: profile?.kyc_level > 0 ? 'var(--color-success)' : '#666',
                               display: 'inline-block' }} />
                {profile?.kyc_level > 0 ? 'Verified' : 'Unverified'}
              </span>
              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11,
                             background: 'rgba(240,185,11,0.15)', color: 'var(--color-primary)',
                             fontWeight: 600 }}>
                VIP {profile?.vip_level || 0}
              </span>
            </div>
          </div>
          <ChevronRight size={18} color="var(--color-muted)" />
        </div>
      </div>

      {/* Menu Sections */}
      {menuSections.map((section, si) => (
        <div key={si} style={{ marginTop: 12 }}>
          <div style={{ background: 'var(--color-surface)',
                        borderTop: '1px solid var(--color-border)',
                        borderBottom: '1px solid var(--color-border)' }}>
            {section.items.map(({ icon: Icon, label, sub, action, badge }: any, i) => (
              <div key={label} onClick={action}
                style={{ display: 'flex', alignItems: 'center', gap: 14,
                         padding: '14px 16px', cursor: 'pointer',
                         borderBottom: i < section.items.length - 1
                           ? '1px solid var(--color-border)' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ width: 38, height: 38, borderRadius: 10,
                              background: 'var(--color-surface2)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={19} color="var(--color-muted)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 1 }}>
                    {sub}
                  </div>
                </div>
                {badge && (
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10,
                                 background: 'rgba(246,70,93,0.15)',
                                 color: 'var(--color-danger)', fontWeight: 700 }}>
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
      <div style={{ margin: '20px 16px 0' }}>
        <button onClick={handleLogout} style={{
          width: '100%', padding: '14px', borderRadius: 12,
          background: 'rgba(246,70,93,0.06)', border: '1px solid rgba(246,70,93,0.15)',
          cursor: 'pointer', color: 'var(--color-danger)', fontSize: 15,
          fontWeight: 700, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8
        }}>
          <LogOut size={18} /> Log out
        </button>
      </div>

      {/* Version */}
      <div style={{ textAlign: 'center', color: 'var(--color-muted)',
                    fontSize: 12, marginTop: 16 }}>
        VDExchange v1.0.0
      </div>
    </div>
  );
}
