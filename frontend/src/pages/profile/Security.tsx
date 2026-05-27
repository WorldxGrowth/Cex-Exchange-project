import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../../services/api';
import { ChevronLeft, ChevronRight, Shield, Smartphone, Mail,
         Key, Clock, Trash2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

// Change Password
const ChangePassword = ({ onBack }: any) => {
  const [form, setForm] = useState({ current_password:'', new_password:'', confirm_password:'' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.current_password || !form.new_password) { toast.error('Fill all fields'); return; }
    if (form.new_password !== form.confirm_password) { toast.error('Passwords do not match'); return; }
    if (form.new_password.length < 8) { toast.error('Min 8 characters'); return; }
    setLoading(true);
    try {
      await userAPI.changePassword({ current_password: form.current_password, new_password: form.new_password });
      toast.success('Password changed!'); onBack();
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const inp: any = {
    width:'100%', padding:'12px 44px 12px 14px', borderRadius:10,
    border:'1px solid var(--color-border)', background:'var(--color-surface2)',
    color:'var(--color-text)', fontSize:14, outline:'none', boxSizing:'border-box'
  };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                    borderBottom:'1px solid var(--color-border)' }}>
        <button onClick={onBack} style={{ background:'none', border:'none',
                 cursor:'pointer', color:'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight:700, fontSize:16, color:'var(--color-text)' }}>Change Password</span>
      </div>
      <div style={{ padding:'20px 16px' }}>
        {[
          { key:'current_password', label:'Current Password' },
          { key:'new_password', label:'New Password (min 8 chars)' },
          { key:'confirm_password', label:'Confirm New Password' }
        ].map(({ key, label }, i) => (
          <div key={key} style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, color:'var(--color-muted)', marginBottom:6 }}>{label}</div>
            <div style={{ position:'relative' }}>
              <input type={show ? 'text' : 'password'} value={(form as any)[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
                placeholder="••••••••" style={inp} />
              {i === 0 && (
                <button onClick={() => setShow(!show)} style={{
                  position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', color:'var(--color-muted)'
                }}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              )}
            </div>
          </div>
        ))}
        <button onClick={handleSubmit} disabled={loading} style={{
          width:'100%', padding:'13px', borderRadius:10, border:'none',
          background:'var(--color-primary)', color:'#000', fontWeight:700,
          cursor:'pointer', fontSize:15
        }}>
          {loading ? 'Changing...' : 'Change Password'}
        </button>
      </div>
    </div>
  );
};

// Mobile Binding Page
const MobileBinding = ({ onBack, currentPhone }: any) => {
  const [step, setStep] = useState<'input'|'otp'>('input');
  const [phone, setPhone] = useState(currentPhone || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) { toast.error('Enter valid phone number'); return; }
    setLoading(true);
    // Simulate OTP send - real implementation needed
    setTimeout(() => {
      setLoading(false);
      setStep('otp');
      toast.success('OTP sent! (Demo: use 123456)');
    }, 1000);
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 4) { toast.error('Enter OTP'); return; }
    setLoading(true);
    try {
      // Save phone
      await userAPI.updateProfile({ phone });
      toast.success('Phone number linked!');
      onBack();
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally { setLoading(false); }
  };

  const inp: any = {
    width:'100%', padding:'14px', borderRadius:10,
    border:'2px solid var(--color-border)', background:'var(--color-surface2)',
    color:'var(--color-text)', fontSize:16, outline:'none', boxSizing:'border-box'
  };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                    borderBottom:'1px solid var(--color-border)' }}>
        <button onClick={onBack} style={{ background:'none', border:'none',
                 cursor:'pointer', color:'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight:700, fontSize:16, color:'var(--color-text)' }}>
          {currentPhone ? 'Change Phone' : 'Link Phone Number'}
        </span>
      </div>

      <div style={{ padding:'24px 16px' }}>
        {step === 'input' ? (
          <>
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <Smartphone size={48} color="var(--color-primary)" style={{ marginBottom:10 }} />
              <div style={{ fontSize:15, fontWeight:600, color:'var(--color-text)', marginBottom:6 }}>
                Link your phone number
              </div>
              <div style={{ fontSize:13, color:'var(--color-muted)' }}>
                Used for login verification and account recovery
              </div>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--color-muted)', marginBottom:6 }}>Phone Number</div>
              <div style={{ display:'flex', gap:8 }}>
                <div style={{ padding:'14px 12px', borderRadius:10, background:'var(--color-surface2)',
                              border:'1px solid var(--color-border)', fontSize:14,
                              color:'var(--color-text)', whiteSpace:'nowrap' }}>
                  +91
                </div>
                <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))}
                  type="tel" placeholder="98765 43210" maxLength={10}
                  style={{ ...inp, flex:1 }} />
              </div>
            </div>

            <button onClick={handleSendOTP} disabled={loading} style={{
              width:'100%', padding:'13px', borderRadius:10, border:'none',
              background: loading ? 'var(--color-border)' : 'var(--color-primary)',
              color:'#000', fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', fontSize:15
            }}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </>
        ) : (
          <>
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--color-text)', marginBottom:6 }}>
                Enter verification code
              </div>
              <div style={{ fontSize:13, color:'var(--color-muted)' }}>
                Code sent to +91 {phone}
              </div>
            </div>

            <div style={{ marginBottom:8 }}>
              <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
                type="tel" maxLength={6} placeholder="000000" autoFocus
                style={{ ...inp, textAlign:'center', fontSize:24, fontWeight:700, letterSpacing:10 }} />
            </div>

            <div style={{ textAlign:'center', marginBottom:20 }}>
              <button onClick={() => setStep('input')} style={{
                background:'none', border:'none', cursor:'pointer',
                color:'var(--color-primary)', fontSize:13
              }}>
                Resend OTP
              </button>
            </div>

            <button onClick={handleVerifyOTP} disabled={loading || otp.length < 4} style={{
              width:'100%', padding:'13px', borderRadius:10, border:'none',
              background: (loading || otp.length < 4) ? 'var(--color-border)' : 'var(--color-primary)',
              color:'#000', fontWeight:700,
              cursor: (loading || otp.length < 4) ? 'not-allowed' : 'pointer', fontSize:15
            }}>
              {loading ? 'Verifying...' : 'Verify & Link'}
            </button>

            <button onClick={() => setStep('input')} style={{
              width:'100%', padding:'10px', marginTop:8, borderRadius:10,
              border:'none', background:'none', color:'var(--color-muted)',
              cursor:'pointer', fontSize:13
            }}>← Back</button>
          </>
        )}
      </div>
    </div>
  );
};

// Login History
const LoginHistory = ({ onBack }: any) => {
  const [history, setHistory] = useState<any[]>([]);
  useEffect(() => { userAPI.getLoginHistory().then((res: any) => setHistory(res.data || [])); }, []);
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                    borderBottom:'1px solid var(--color-border)' }}>
        <button onClick={onBack} style={{ background:'none', border:'none',
                 cursor:'pointer', color:'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight:700, fontSize:16, color:'var(--color-text)' }}>Login History</span>
      </div>
      <div>
        {history.length === 0
          ? <div style={{ textAlign:'center', padding:40, color:'var(--color-muted)' }}>No history</div>
          : history.map((h: any, i: number) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between',
                                   alignItems:'center', padding:'14px 16px',
                                   borderBottom:'1px solid var(--color-border)' }}>
              <div>
                <div style={{ fontSize:14, color:'var(--color-text)', fontWeight:500 }}>
                  {h.ip_address} · {h.device_type}
                </div>
                <div style={{ fontSize:12, color:'var(--color-muted)', marginTop:2 }}>
                  {new Date(h.created_at).toLocaleString()}
                </div>
              </div>
              <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600,
                             background: h.status==='success' ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)',
                             color: h.status==='success' ? 'var(--color-success)' : 'var(--color-danger)' }}>
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
  if (subPage === 'phone') return <MobileBinding onBack={() => {
    setSubPage(null);
    userAPI.getProfile().then((res: any) => setProfile(res.data));
  }} currentPhone={profile?.phone} />;

  // Security score
  const score = [twoFAEnabled, !!profile?.phone, !!profile?.email_verified].filter(Boolean).length;
  const scoreLabel = score === 0 ? 'Low' : score === 1 ? 'Medium' : score === 2 ? 'Good' : 'High';
  const scoreColor = score === 0 ? 'var(--color-danger)' : score === 1 ? 'var(--color-warning)'
    : score === 2 ? 'var(--color-primary)' : 'var(--color-success)';

  const menuItems = [
    {
      icon: Key, label: 'Login Password', color: '#1890ff',
      sub: 'Change your login password',
      action: () => setSubPage('password')
    },
    {
      icon: Mail, label: 'Email', color: '#0ecb81',
      sub: profile?.email || 'Not set',
      badge: profile?.email_verified ? '✓ Verified' : 'Unverified',
      badgeColor: profile?.email_verified ? 'var(--color-success)' : 'var(--color-danger)',
      action: () => toast('Email change coming soon')
    },
    {
      icon: Smartphone, label: 'Phone Number', color: '#f0b90b',
      sub: profile?.phone ? `+91 ${profile.phone.slice(0,3)}****${profile.phone.slice(-3)}` : 'Not linked',
      badge: profile?.phone ? '✓ Linked' : 'Link Now',
      badgeColor: profile?.phone ? 'var(--color-success)' : 'var(--color-primary)',
      action: () => setSubPage('phone')
    },
    {
      icon: Shield, label: 'Google Authenticator', color: '#722ed1',
      sub: twoFAEnabled ? 'Enabled - Your account is protected' : 'Not enabled',
      toggle: true, toggleValue: twoFAEnabled,
      toggleChange: () => navigate('/2fa'),
      action: () => navigate('/2fa')
    },
    {
      icon: Clock, label: 'Login History', color: '#13c2c2',
      sub: 'View recent login activity',
      action: () => setSubPage('history')
    },
    {
      icon: Trash2, label: 'Delete Account', color: '#f6465d',
      sub: 'Permanently delete your account',
      action: () => toast.error('Contact support to delete account'),
      danger: true
    },
  ];

  return (
    <div style={{ background:'var(--color-bg)', minHeight:'100vh', paddingBottom:20 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                    background:'var(--color-surface)', borderBottom:'1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background:'none', border:'none',
                 cursor:'pointer', color:'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight:700, fontSize:17, color:'var(--color-text)' }}>Security</span>
      </div>

      {/* Security Score */}
      <div style={{ margin:'12px 16px', padding:'16px', borderRadius:12,
                    background:'var(--color-surface)', border:'1px solid var(--color-border)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span style={{ fontSize:13, color:'var(--color-muted)' }}>Account Security</span>
          <span style={{ fontSize:14, fontWeight:700, color:scoreColor }}>{scoreLabel}</span>
        </div>
        <div style={{ height:6, borderRadius:3, background:'var(--color-surface2)', overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:3, background:scoreColor,
                        width:`${(score/3)*100}%`, transition:'width 0.5s' }} />
        </div>
        <div style={{ fontSize:12, color:'var(--color-muted)', marginTop:6 }}>
          {score < 3 ? 'Complete security setup for better protection' : 'Your account is fully secured! 🔒'}
        </div>
      </div>

      {/* Menu Items */}
      <div style={{ background:'var(--color-surface)', margin:'0',
                    borderTop:'1px solid var(--color-border)',
                    borderBottom:'1px solid var(--color-border)' }}>
        {menuItems.map(({ icon: Icon, label, sub, action, color, badge, badgeColor,
                          toggle, toggleValue, toggleChange, danger }: any, i) => (
          <div key={label} onClick={toggle ? toggleChange : action}
            style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
                     cursor:'pointer',
                     borderBottom: i < menuItems.length-1 ? '1px solid var(--color-border)' : 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

            <div style={{ width:40, height:40, borderRadius:10, background:color+'20',
                          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Icon size={20} color={danger ? 'var(--color-danger)' : color} />
            </div>

            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:500,
                            color: danger ? 'var(--color-danger)' : 'var(--color-text)' }}>
                {label}
              </div>
              <div style={{ fontSize:12, color:'var(--color-muted)', marginTop:1 }}>
                {sub}
                {badge && (
                  <span style={{ marginLeft:6, padding:'1px 6px', borderRadius:8, fontSize:10,
                                 background:(badgeColor||'')+'20', color:badgeColor, fontWeight:600 }}>
                    {badge}
                  </span>
                )}
              </div>
            </div>

            {toggle ? (
              <div style={{
                width:44, height:24, borderRadius:12, cursor:'pointer', flexShrink:0,
                background: toggleValue ? 'var(--color-success)' : 'var(--color-surface2)',
                border:`1px solid ${toggleValue ? 'var(--color-success)' : 'var(--color-border)'}`,
                position:'relative', transition:'all 0.2s'
              }}>
                <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff',
                              position:'absolute', top:2,
                              left: toggleValue ? 22 : 2, transition:'left 0.2s' }} />
              </div>
            ) : (
              <ChevronRight size={18} color="var(--color-muted)" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
