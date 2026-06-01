import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { userAPI, authAPI } from '../../services/api';
import {
  Shield, LogOut, ChevronRight, Globe,
  Moon, Sun, Gift, Users, HelpCircle,
  Copy, Check, Camera, User, FileText,
  Bell, Lock, History
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Profile() {
  const navigate = useNavigate();
  const { user, theme, toggleTheme, logout } = useStore();
  const [profile, setProfile] = useState<any>(null);
  const [copied, setCopied]   = useState(false);
  const [avatar, setAvatar]   = useState<string>('');
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
    toast.success('UID copied!');
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAvatar(base64);
      userAPI.uploadAvatar({ avatar: base64 })
        .then(() => toast.success('Avatar updated!'))
        .catch(() => toast.error('Failed'));
    };
    reader.readAsDataURL(file);
  };

  const maskEmail = (email: string) => {
    if (!email) return '---';
    const [name, domain] = email.split('@');
    return name.slice(0, 3) + '****@' + domain;
  };

  const maskPhone = (phone: string) => {
    if (!phone) return 'Not set';
    return phone.slice(0, 3) + '****' + phone.slice(-3);
  };

  const kycStatus = () => {
    if (profile?.kyc_level > 0) return { label: 'Verified', color: 'var(--color-success)' };
    return { label: 'Unverified', color: 'var(--color-danger)' };
  };

  const menuSections = [
    {
      title: 'Account',
      items: [
        {
          icon: User, label: 'Account Info',
          sub: maskEmail(user?.email || ''),
          action: () => navigate('/edit-profile')
        },
        {
          icon: FileText, label: 'ID Verification',
          sub: kycStatus().label,
          subColor: kycStatus().color,
          action: () => navigate('/kyc'),
          badge: profile?.kyc_level === 0 ? 'Required' : null,
          badgeColor: '#f6465d'
        },
        {
          icon: Shield, label: 'Security',
          sub: profile?.two_fa_enabled ? '2FA Enabled' : '2FA Disabled',
          subColor: profile?.two_fa_enabled ? 'var(--color-success)' : 'var(--color-muted)',
          action: () => navigate('/security')
        },
      ]
    },
    {
      title: 'Features',
      items: [
        {
          icon: Users, label: 'Referral Program',
          sub: 'Invite friends, earn rewards',
          action: () => navigate('/referral')
        },
        {
          icon: Gift, label: 'List Your Token',
          sub: 'Apply for token listing',
          action: () => navigate('/listing'),
          badge: 'HOT', badgeColor: '#f6465d'
        },
        {
          icon: History, label: 'Login History',
          sub: 'View recent logins',
          action: () => navigate('/security')
        },
      ]
    },
    {
      title: 'Settings',
      items: [
        {
          icon: theme === 'dark' ? Sun : Moon,
          label: 'Theme',
          sub: theme === 'dark' ? 'Dark Mode' : 'Light Mode',
          action: toggleTheme
        },
        {
          icon: HelpCircle, label: 'Help & Support',
          sub: 'FAQ, Contact us',
          action: () => navigate('/support')
        },
      ]
    }
  ];

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', paddingBottom: 80 }}>

      {/* ── Profile Header ── */}
      <div style={{
        background: 'var(--color-surface)',
        padding: '24px 20px 20px',
        borderBottom: '1px solid var(--color-border)'
      }}>
        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column',
                      alignItems: 'center', marginBottom: 16 }}>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: avatar ? 'transparent' : 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', border: '3px solid var(--color-border)'
            }}>
              {avatar
                ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 28, fontWeight: 800, color: '#000' }}>
                    {(user?.email || 'U').charAt(0).toUpperCase()}
                  </span>
              }
            </div>
            <button onClick={() => fileRef.current?.click()} style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--color-surface2)',
              border: '2px solid var(--color-bg)',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Camera size={12} color="var(--color-muted)" />
            </button>
            <input ref={fileRef} type="file" accept="image/*"
              style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>

          {/* Email masked */}
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)',
                        marginBottom: 4 }}>
            {maskEmail(user?.email || '')}
          </div>

          {/* KYC badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20,
                        background: kycStatus().color + '20' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%',
                          background: kycStatus().color }} />
            <span style={{ fontSize: 12, color: kycStatus().color, fontWeight: 600 }}>
              {kycStatus().label}
            </span>
          </div>
        </div>

        {/* UID + VIP row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          background: 'var(--color-surface2)', borderRadius: 10,
          padding: '10px 14px'
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)',
                          marginBottom: 2 }}>UID</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600,
                             color: 'var(--color-text)' }}>
                {profile?.uid || '---'}
              </span>
              <button onClick={handleCopyUID} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: copied ? 'var(--color-success)' : 'var(--color-muted)',
                padding: 0, display: 'flex'
              }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--color-muted)',
                          marginBottom: 2 }}>VIP Level</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4,
                          justifyContent: 'flex-end' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%',
                            background: 'var(--color-primary)' }} />
              <span style={{ fontSize: 13, fontWeight: 700,
                             color: 'var(--color-primary)' }}>
                VIP {profile?.vip_level || 0}
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--color-muted)',
                          marginBottom: 2 }}>Phone</div>
            <span style={{ fontSize: 13, fontWeight: 600,
                           color: profile?.phone ? 'var(--color-text)' : 'var(--color-danger)' }}>
              {profile?.phone ? maskPhone(profile.phone) : 'Not bound'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Menu Sections ── */}
      {menuSections.map((section, si) => (
        <div key={si} style={{ marginTop: 12 }}>
          <div style={{ padding: '4px 16px 6px',
                        fontSize: 12, color: 'var(--color-muted)',
                        fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: 0.5 }}>
            {section.title}
          </div>
          <div style={{
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
            borderBottom: '1px solid var(--color-border)'
          }}>
            {section.items.map(({ icon: Icon, label, sub, subColor, action, badge, badgeColor }: any, i) => (
              <div key={label} onClick={action}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', cursor: 'pointer',
                  borderBottom: i < section.items.length - 1
                    ? '1px solid var(--color-border)' : 'none'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--color-surface2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon size={18} color="var(--color-muted)" />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: 'var(--color-text)',
                                fontWeight: 500 }}>{label}</div>
                  {sub && (
                    <div style={{ fontSize: 12, marginTop: 1,
                                  color: subColor || 'var(--color-muted)' }}>
                      {sub}
                    </div>
                  )}
                </div>

                {badge && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 10,
                    background: (badgeColor || '#f6465d') + '20',
                    color: badgeColor || '#f6465d', fontWeight: 700
                  }}>{badge}</span>
                )}
                <ChevronRight size={15} color="var(--color-muted)" />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── Logout ── */}
      <div style={{ padding: '20px 16px 0' }}>
        <button onClick={handleLogout} style={{
          width: '100%', padding: 14, borderRadius: 12,
          background: 'rgba(246,70,93,0.08)',
          border: '1px solid rgba(246,70,93,0.2)',
          cursor: 'pointer', color: 'var(--color-danger)',
          fontSize: 15, fontWeight: 700,
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8
        }}>
          <LogOut size={18} /> Log out
        </button>
      </div>

      <div style={{ textAlign: 'center', color: 'var(--color-muted)',
                    fontSize: 12, marginTop: 16, paddingBottom: 8 }}>
        VDExchange v1.0.0
      </div>
    </div>
  );
}
