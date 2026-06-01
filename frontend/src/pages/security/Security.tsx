import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { userAPI, otpAPI } from '../../services/api';
import {
  ArrowLeft, ChevronRight, ChevronDown, Shield, Key, Smartphone,
  Lock, Clock, Trash2, Eye, EyeOff, Check, CheckCircle,
  XCircle, ToggleLeft, ToggleRight, MapPin, Monitor, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Change Password ───────────────────────────────
const ChangePassword = ({ onBack }: any) => {
  const [form, setForm] = useState({
    current_password: '', new_password: '', confirm_password: ''
  });
  const [show, setShow]       = useState({ cur: false, new: false, con: false });
  const [loading, setLoading] = useState(false);

  const checks = [
    { label: 'At least 8 characters', ok: form.new_password.length >= 8 },
    { label: 'Contains uppercase',    ok: /[A-Z]/.test(form.new_password) },
    { label: 'Contains number',       ok: /\d/.test(form.new_password) },
  ];

  const handleSubmit = async () => {
    if (!form.current_password || !form.new_password) { toast.error('Fill all fields'); return; }
    if (form.new_password !== form.confirm_password)  { toast.error('Passwords do not match'); return; }
    if (!checks.every(c => c.ok)) { toast.error('Password too weak'); return; }
    setLoading(true);
    try {
      await userAPI.changePassword({
        current_password: form.current_password,
        new_password:     form.new_password
      });
      toast.success('Password changed!');
      onBack();
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const inp: any = {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 15, outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
                    height: 56, background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Change Password</span>
      </div>
      <div style={{ padding: 20 }}>
        {[
          { key: 'current_password', label: 'Current Password', showKey: 'cur' },
          { key: 'new_password',     label: 'New Password',     showKey: 'new' },
          { key: 'confirm_password', label: 'Confirm Password', showKey: 'con' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>{f.label}</div>
            <div style={{ position: 'relative' }}>
              <input type={(show as any)[f.showKey] ? 'text' : 'password'}
                value={(form as any)[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                style={inp} />
              <button onClick={() => setShow({ ...show, [f.showKey]: !(show as any)[f.showKey] })}
                style={{ position: 'absolute', right: 14, top: '50%',
                         transform: 'translateY(-50%)', background: 'none',
                         border: 'none', cursor: 'pointer',
                         color: 'var(--color-muted)', display: 'flex' }}>
                {(show as any)[f.showKey] ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        ))}

        {form.new_password.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {checks.map(c => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center',
                                          gap: 8, marginBottom: 6 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                              background: c.ok ? 'var(--color-success)' : 'var(--color-surface2)',
                              border: `2px solid ${c.ok ? 'var(--color-success)' : 'var(--color-border)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.ok && <Check size={9} color="#000" strokeWidth={3} />}
                </div>
                <span style={{ fontSize: 12,
                               color: c.ok ? 'var(--color-success)' : 'var(--color-muted)' }}>
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', padding: 16, borderRadius: 12, border: 'none',
          background: loading ? 'var(--color-surface2)' : 'var(--color-primary)',
          color: loading ? 'var(--color-muted)' : '#000',
          fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
        }}>
          {loading ? 'Changing...' : 'Change Password'}
        </button>
      </div>
    </div>
  );
};

// ── Phone Binding ─────────────────────────────────
const PhoneBinding = ({ onBack, currentPhone }: any) => {
  const [step, setStep]           = useState<'input'|'otp'>('input');
  const [phone, setPhone]         = useState('');
  const [otp, setOtp]             = useState(['','','','','','']);
  const [resendSec, setResendSec] = useState(0);
  const [loading, setLoading]     = useState(false);
  const refs                      = Array.from({ length: 6 }, () => null) as any[];

  const startTimer = () => {
    setResendSec(120);
    const t = setInterval(() => {
      setResendSec(s => { if (s <= 1) { clearInterval(t); return 0; } return s - 1; });
    }, 1000);
  };

  const handleSendOTP = async () => {
    if (phone.replace(/\D/g,'').length < 10) { toast.error('Enter valid phone'); return; }
    setLoading(true);
    try {
      await otpAPI.send(phone.replace(/\D/g,''), 'bind_phone');
      toast.success('OTP sent!');
      setStep('otp');
      startTimer();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleVerify = async (codeOverride?: string) => {
    const code = codeOverride || otp.join('');
    if (code.length < 6) return;
    setLoading(true);
    try {
      const verRes: any = await otpAPI.verify(phone.replace(/\D/g,''), code, 'bind_phone');
      if (!verRes.data?.verified) { toast.error('Invalid OTP'); setLoading(false); return; }
      await userAPI.updateProfile({ phone: phone.replace(/\D/g,'') });
      toast.success('Phone bound successfully!');
      onBack(true);
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleOtpChange = (i: number, val: string) => {
    const v = val.replace(/\D/g,'').slice(-1);
    const next = [...otp]; next[i] = v; setOtp(next);
    if (v && i < 5) refs[i+1]?.focus();
    if (next.join('').length === 6) setTimeout(() => handleVerify(next.join('')), 100);
  };

  const inp: any = {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 15, outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
                    height: 56, background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => step === 'otp' ? setStep('input') : onBack()}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
                   color: 'var(--color-text)', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>
          {currentPhone ? 'Change Phone Number' : 'Bind Phone Number'}
        </span>
      </div>

      <div style={{ padding: 24 }}>
        {step === 'input' ? (
          <>
            {currentPhone && (
              <div style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 20,
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            fontSize: 14, color: 'var(--color-muted)' }}>
                Current: {currentPhone.slice(0,3)}****{currentPhone.slice(-3)}
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
                Phone Number (with country code)
              </div>
              <input value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g,''))}
                placeholder="e.g. 919876543210"
                type="tel" style={inp} />
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
                Include country code — 91 for India
              </div>
            </div>
            <button onClick={handleSendOTP} disabled={loading} style={{
              width: '100%', padding: 16, borderRadius: 12, border: 'none',
              background: loading ? 'var(--color-surface2)' : 'var(--color-primary)',
              color: loading ? 'var(--color-muted)' : '#000',
              fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
            }}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              Verify your number
            </div>
            <div style={{ color: 'var(--color-muted)', fontSize: 14, marginBottom: 4 }}>
              Enter the 6-digit code sent to
            </div>
            <div style={{ fontWeight: 700, marginBottom: 28, fontSize: 15 }}>+{phone}</div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
              {otp.map((digit, i) => (
                <input key={i} ref={el => { refs[i] = el; }}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Backspace' && !otp[i] && i > 0) refs[i-1]?.focus(); }}
                  maxLength={1} type="tel"
                  style={{
                    width: 46, height: 54, borderRadius: 12,
                    border: '2px solid ' + (digit ? 'var(--color-primary)' : 'var(--color-border)'),
                    background: digit ? '#f0b90b15' : 'var(--color-surface2)',
                    color: 'var(--color-text)', fontSize: 22, fontWeight: 800,
                    textAlign: 'center', outline: 'none'
                  }} />
              ))}
            </div>

            <button onClick={() => handleVerify()}
              disabled={otp.join('').length < 6 || loading} style={{
              width: '100%', padding: 16, borderRadius: 12, border: 'none',
              background: otp.join('').length < 6 ? 'var(--color-surface2)' : 'var(--color-primary)',
              color: otp.join('').length < 6 ? 'var(--color-muted)' : '#000',
              fontWeight: 700, cursor: 'pointer', fontSize: 15, marginBottom: 16
            }}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button onClick={async () => {
                if (resendSec > 0) return;
                await otpAPI.send(phone.replace(/\D/g,''), 'bind_phone');
                toast.success('OTP resent'); startTimer();
                setOtp(['','','','','','']);
              }} style={{
                background: 'none', border: 'none',
                cursor: resendSec > 0 ? 'not-allowed' : 'pointer',
                color: resendSec > 0 ? 'var(--color-muted)' : 'var(--color-primary)',
                fontSize: 14, fontWeight: 500
              }}>
                {resendSec > 0 ? `Resend (${resendSec}s)` : 'Resend OTP'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Login History ─────────────────────────────────
const LoginHistory = ({ onBack }: any) => {
  const [history, setHistory]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    userAPI.getLoginHistory().then((res: any) => {
      setHistory(res.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
                    height: 56, background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Login History</span>
        <span style={{ marginLeft: 'auto', fontSize: 13,
                       color: 'var(--color-muted)' }}>
          Last {history.length} records
        </span>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>
            Loading...
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>
            No login history
          </div>
        ) : history.map((h: any, i: number) => (
          <div key={i} onClick={() => setExpanded(expanded === i ? null : i)}
            style={{ borderRadius: 12, marginBottom: 10, overflow: 'hidden',
                     background: 'var(--color-surface)',
                     border: '1px solid var(--color-border)',
                     cursor: 'pointer' }}>

            {/* Main row */}
            <div style={{ padding: '14px 16px', display: 'flex',
                          alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: h.status === 'success' ? '#0ecb8118' : '#f6465d18',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {h.status === 'success'
                  ? <CheckCircle size={18} color="var(--color-success)" />
                  : <XCircle size={18} color="var(--color-danger)" />
                }
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center',
                              justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14,
                                 color: h.status === 'success'
                                   ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {h.status === 'success' ? 'Login Successful' : 'Login Failed'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-muted)',
                                 flexShrink: 0 }}>
                    {new Date(h.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)',
                              marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={11} />
                  <span>{h.ip_address}</span>
                  {h.device_type && (
                    <>
                      <span style={{ opacity: 0.4 }}>•</span>
                      <Monitor size={11} />
                      <span style={{ textTransform: 'capitalize' }}>{h.device_type}</span>
                    </>
                  )}
                </div>
              </div>

              <ChevronDown size={16} color="var(--color-muted)"
                style={{ transform: expanded === i ? 'rotate(180deg)' : 'none',
                         transition: '0.2s', flexShrink: 0 }} />
            </div>

            {/* Expanded details */}
            {expanded === i && (
              <div style={{ padding: '0 16px 14px',
                            borderTop: '1px solid var(--color-border)' }}>
                <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Time</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text)' }}>
                      {new Date(h.created_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                      })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>IP Address</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text)',
                                   fontFamily: 'monospace' }}>{h.ip_address}</span>
                  </div>
                  {h.device_type && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Device</span>
                      <span style={{ fontSize: 12, color: 'var(--color-text)',
                                     textTransform: 'capitalize' }}>{h.device_type}</span>
                    </div>
                  )}
                  {h.user_agent && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Browser</span>
                      <span style={{ fontSize: 11, color: 'var(--color-muted)',
                                     lineHeight: 1.4, wordBreak: 'break-all' }}>
                        {h.user_agent}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Anti-Phishing ─────────────────────────────────
const AntiPhishing = ({ onBack, current }: any) => {
  const [code, setCode]       = useState(current || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (code.length < 4) { toast.error('Min 4 characters'); return; }
    setLoading(true);
    try {
      await userAPI.setAntiPhishCode({ code });
      toast.success('Anti-phishing code set!');
      onBack(true);
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
                    height: 56, background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Anti-Phishing Code</span>
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ padding: 16, borderRadius: 12, background: '#f0b90b10',
                      border: '1px solid #f0b90b25', marginBottom: 20,
                      display: 'flex', gap: 10 }}>
          <AlertTriangle size={18} color="#f0b90b" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ color: 'var(--color-text)', fontSize: 13,
                      lineHeight: 1.6, margin: 0 }}>
            Set a unique code that will appear in all VDExchange emails.
            If an email doesn't show your code, it's a phishing attempt.
          </p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
            Your Code (4-20 characters)
          </div>
          <input value={code} onChange={e => setCode(e.target.value)}
            placeholder="e.g. MySecureCode123"
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12,
              border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
              color: 'var(--color-text)', fontSize: 15, outline: 'none', boxSizing: 'border-box'
            }} />
        </div>
        <button onClick={handleSave} disabled={loading} style={{
          width: '100%', padding: 16, borderRadius: 12, border: 'none',
          background: loading ? 'var(--color-surface2)' : 'var(--color-primary)',
          color: loading ? 'var(--color-muted)' : '#000',
          fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
        }}>
          {loading ? 'Saving...' : 'Save Code'}
        </button>
      </div>
    </div>
  );
};

// ── Main Security Page ────────────────────────────
export default function Security() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [subPage, setSubPage]         = useState<string | null>(null);
  const [profile, setProfile]         = useState<any>(null);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  const fetchProfile = () => {
    userAPI.getProfile().then((res: any) => {
      setProfile(res.data);
      setTwoFAEnabled(res.data?.two_fa_enabled || false);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchProfile();
    const state = location.state as any;
    if (state?.tab === 'phone') setSubPage('phone');
  }, []);

  if (subPage === 'password')
    return <ChangePassword onBack={() => setSubPage(null)} />;
  if (subPage === 'phone')
    return <PhoneBinding currentPhone={profile?.phone}
      onBack={(refresh?: boolean) => { setSubPage(null); if (refresh) fetchProfile(); }} />;
  if (subPage === 'history')
    return <LoginHistory onBack={() => setSubPage(null)} />;
  if (subPage === 'antiphish')
    return <AntiPhishing current={profile?.anti_phish_code}
      onBack={(refresh?: boolean) => { setSubPage(null); if (refresh) fetchProfile(); }} />;

  const secScore = [
    profile?.phone, twoFAEnabled,
    profile?.anti_phish_code, profile?.kyc_level > 0,
  ].filter(Boolean).length;

  const scoreLabel = secScore <= 1 ? 'Low' : secScore === 2 ? 'Medium'
    : secScore === 3 ? 'Good' : 'High';
  const scoreColor = secScore <= 1 ? 'var(--color-danger)'
    : secScore === 2 ? 'var(--color-warning)' : 'var(--color-success)';

  const items = [
    {
      icon: Key, label: 'Login Password',
      sub: 'Change your login password',
      action: () => setSubPage('password'), color: '#1890ff'
    },
    {
      icon: Smartphone, label: 'Phone Number',
      sub: profile?.phone
        ? `Linked: ${profile.phone.slice(0,3)}****${profile.phone.slice(-3)}`
        : 'Not bound — recommended',
      subColor: profile?.phone ? 'var(--color-success)' : 'var(--color-warning)',
      statusIcon: profile?.phone ? CheckCircle : AlertTriangle,
      statusColor: profile?.phone ? 'var(--color-success)' : 'var(--color-warning)',
      action: () => setSubPage('phone'), color: '#0ecb81'
    },
    {
      icon: Shield, label: 'Google Authenticator',
      sub: twoFAEnabled ? '2FA Enabled' : 'Not enabled — recommended',
      subColor: twoFAEnabled ? 'var(--color-success)' : 'var(--color-warning)',
      statusIcon: twoFAEnabled ? CheckCircle : AlertTriangle,
      statusColor: twoFAEnabled ? 'var(--color-success)' : 'var(--color-warning)',
      toggle: true, toggled: twoFAEnabled,
      onToggle: () => navigate('/2fa'),
      action: () => navigate('/2fa'),
      color: '#f0b90b'
    },
    {
      icon: Lock, label: 'Anti-Phishing Code',
      sub: profile?.anti_phish_code
        ? `Active: ${profile.anti_phish_code}`
        : 'Protect against fake emails',
      subColor: profile?.anti_phish_code ? 'var(--color-success)' : 'var(--color-muted)',
      statusIcon: profile?.anti_phish_code ? CheckCircle : null,
      statusColor: 'var(--color-success)',
      action: () => setSubPage('antiphish'), color: '#722ed1'
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
        if (window.confirm('Are you sure? This cannot be undone!'))
          toast.error('Contact support to delete account');
      },
      color: '#f6465d', danger: true
    },
  ];

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
                    height: 56, background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Security</span>
      </div>

      <div style={{ padding: 16 }}>
        {/* Security Score */}
        <div style={{ padding: 16, borderRadius: 12, marginBottom: 20,
                      background: 'linear-gradient(135deg, rgba(24,144,255,0.08), rgba(114,46,209,0.08))',
                      border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>
                Security Level
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={18} color={scoreColor} />
                <span style={{ fontSize: 20, fontWeight: 700, color: scoreColor }}>
                  {scoreLabel}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor }}>
                {secScore}/4
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>checks passed</div>
            </div>
          </div>
          <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3 }}>
            <div style={{
              height: '100%', borderRadius: 3, background: scoreColor,
              width: `${(secScore / 4) * 100}%`, transition: 'width 0.5s ease'
            }} />
          </div>
        </div>

        {/* Items */}
        <div style={{ background: 'var(--color-surface)', borderRadius: 16,
                      border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          {items.map(({ icon: Icon, label, sub, subColor, action, toggle,
                        toggled, onToggle, color, danger, statusIcon: StatusIcon,
                        statusColor }: any, i) => (
            <div key={label} onClick={action}
              style={{ display: 'flex', alignItems: 'center', gap: 12,
                       padding: '14px 16px', cursor: 'pointer',
                       borderBottom: i < items.length - 1
                         ? '1px solid var(--color-border)' : 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

              <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                            background: (color || '#1890ff') + '18',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={19} color={danger ? 'var(--color-danger)' : (color || '#1890ff')} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500,
                              color: danger ? 'var(--color-danger)' : 'var(--color-text)' }}>
                  {label}
                </div>
                <div style={{ fontSize: 12, marginTop: 2, display: 'flex',
                              alignItems: 'center', gap: 4,
                              color: subColor || 'var(--color-muted)' }}>
                  {StatusIcon && <StatusIcon size={11} color={statusColor} />}
                  <span>{sub}</span>
                </div>
              </div>

              {toggle ? (
                <button onClick={e => { e.stopPropagation(); onToggle?.(); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                           color: toggled ? 'var(--color-success)' : 'var(--color-muted)',
                           display: 'flex' }}>
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
