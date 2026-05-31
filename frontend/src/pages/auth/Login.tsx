import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI, twoFAAPI, otpAPI } from '../../services/api';
import { useStore } from '../../store/useStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Zap, ArrowLeft, ChevronRight } from 'lucide-react';

const GOOGLE_AUTH_URL = `${window.location.protocol}//${window.location.hostname}:4005/api/v1/auth/google`;

// ── Step types ────────────────────────────────────
type Step = 'identifier' | 'password' | 'twofa';

export default function Login() {
  const [step, setStep]           = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [otp, setOtp]             = useState(['','','','','','']);
  const otpRefs                   = useRef<(HTMLInputElement|null)[]>([]);
  const { setUser } = useStore();
  const navigate = useNavigate();

  // Detect email vs phone
  const isPhone = /^\d{5,}$/.test(identifier.replace(/\D/g,''));
  const isValid = identifier.length >= 5;
  const canContinue = isValid && !loading;

  // ── Step 1: Check identifier ──────────────────
  const handleContinue = async () => {
    if (!canContinue) return;
    setLoading(true);
    try {
      const res: any = await otpAPI.check(identifier);
      if (!res.data.exists) {
        toast.error('Account not found. Please register.');
        setLoading(false);
        return;
      }
      setStep('password');
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally { setLoading(false); }
  };

  // ── Step 2: Login with password ───────────────
  const handleLogin = async () => {
    if (!password || loading) return;
    setLoading(true);
    try {
      const loginData: any = identifier.includes('@')
        ? { email: identifier.toLowerCase(), password }
        : { phone: identifier.replace(/\D/g,''), password };

      const res: any = await authAPI.login(loginData);

      if (res.data.requires_2fa) {
        setTempToken(res.data.temp_token);
        setStep('twofa');
        toast('Enter your 2FA code', { icon: '🔐' });
      } else {
        setUser(res.data.user, res.data.access_token);
        toast.success('Welcome back!');
        navigate('/home');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Invalid password');
    } finally { setLoading(false); }
  };

  // ── Step 3: 2FA verify ────────────────────────
  const handle2FA = async () => {
    const code = otp.join('');
    if (code.length < 6 || loading) return;
    setLoading(true);
    try {
      const res: any = await twoFAAPI.loginVerify(tempToken, code);
      setUser(res.data.user, res.data.access_token);
      toast.success('Welcome back!');
      navigate('/home');
    } catch (err: any) {
      toast.error(err?.message || 'Invalid code');
      setOtp(['','','','','','']);
      otpRefs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  // ── OTP box input handler ─────────────────────
  const handleOtpChange = (i: number, val: string) => {
    const v = val.replace(/\D/g,'').slice(-1);
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) otpRefs.current[i+1]?.focus();
    if (next.join('').length === 6) {
      // Auto submit
      setTimeout(() => {
        const code = next.join('');
        if (code.length === 6) handle2FADirect(code);
      }, 100);
    }
  };

  const handle2FADirect = async (code: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const res: any = await twoFAAPI.loginVerify(tempToken, code);
      setUser(res.data.user, res.data.access_token);
      toast.success('Welcome back!');
      navigate('/home');
    } catch (err: any) {
      toast.error(err?.message || 'Invalid code');
      setOtp(['','','','','','']);
      otpRefs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i-1]?.focus();
    }
  };

  // ── Styles ────────────────────────────────────
  const inp = {
    width: '100%', padding: '16px', borderRadius: 12,
    background: 'var(--color-surface2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)', fontSize: 16,
    outline: 'none', boxSizing: 'border-box' as const,
  };

  const primaryBtn = (disabled = false) => ({
    width: '100%', padding: '16px', borderRadius: 12, border: 'none',
    background: disabled ? 'var(--color-surface2)' : 'var(--color-primary)',
    color: disabled ? 'var(--color-muted)' : '#000',
    fontSize: 16, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)',
                  display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {step !== 'identifier' ? (
            <button onClick={() => {
              if (step === 'twofa') setStep('password');
              else setStep('identifier');
            }} style={{ background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--color-text)', padding: 4,
                        display: 'flex', alignItems: 'center' }}>
              <ArrowLeft size={22} />
            </button>
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: 8,
                          background: 'var(--color-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="#000" />
            </div>
          )}
        </div>
        <Link to="/register" style={{
          padding: '8px 16px', borderRadius: 20,
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)', textDecoration: 'none',
          fontSize: 14, fontWeight: 600
        }}>Sign up</Link>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 24px 40px',
                    maxWidth: 440, width: '100%', margin: '0 auto' }}>

        {/* ── Step 1: Identifier ── */}
        {step === 'identifier' && (
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8,
                         color: 'var(--color-text)' }}>Log In</h1>
            <p style={{ color: 'var(--color-muted)', fontSize: 15,
                        marginBottom: 32 }}>
              Enter your email or phone number
            </p>

            <div style={{ marginBottom: 16 }}>
              <input
                autoFocus
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canContinue && handleContinue()}
                placeholder="Email / Phone number"
                style={inp}
              />
            </div>

            <button
              onClick={handleContinue}
              disabled={!canContinue}
              style={primaryBtn(!canContinue)}
            >
              {loading ? 'Checking...' : 'Continue'}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center',
                          gap: 12, margin: '24px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            </div>

            {/* Google */}
            <a href={GOOGLE_AUTH_URL} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, padding: '15px', borderRadius: 12, textDecoration: 'none',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface2)',
              color: 'var(--color-text)', fontSize: 15, fontWeight: 600,
              marginBottom: 12
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </a>
          </div>
        )}

        {/* ── Step 2: Password ── */}
        {step === 'password' && (
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8,
                         color: 'var(--color-text)' }}>Enter Password</h1>
            <p style={{ color: 'var(--color-muted)', fontSize: 15,
                        marginBottom: 8 }}>
              Logging in as
            </p>
            <div style={{ padding: '10px 14px', borderRadius: 10,
                          background: 'var(--color-surface2)',
                          marginBottom: 28, display: 'inline-flex',
                          alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--color-text)', fontWeight: 600,
                             fontSize: 14 }}>{identifier}</span>
              <button onClick={() => setStep('identifier')} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-primary)', fontSize: 12, padding: 0
              }}>Change</button>
            </div>

            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input
                autoFocus
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && password && handleLogin()}
                placeholder="Password"
                style={{ ...inp, paddingRight: 48 }}
              />
              <button onClick={() => setShowPass(!showPass)} style={{
                position: 'absolute', right: 14, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--color-muted)',
                display: 'flex', alignItems: 'center'
              }}>
                {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button
              onClick={handleLogin}
              disabled={!password || loading}
              style={primaryBtn(!password || loading)}
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <a href="/forgot-password" style={{
                color: 'var(--color-primary)', fontSize: 14,
                textDecoration: 'none', fontWeight: 500
              }}>
                Forgot password?
              </a>
            </div>
          </div>
        )}

        {/* ── Step 3: 2FA ── */}
        {step === 'twofa' && (
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8,
                         color: 'var(--color-text)' }}>2FA Verification</h1>
            <p style={{ color: 'var(--color-muted)', fontSize: 15,
                        marginBottom: 32, lineHeight: 1.5 }}>
              Enter the 6-digit code from your Google Authenticator app
            </p>

            {/* OTP Boxes */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center',
                          marginBottom: 32 }}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el; }}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  maxLength={1}
                  type="tel"
                  style={{
                    width: 48, height: 56, borderRadius: 12, border: 'none',
                    background: digit ? 'var(--color-primary)' : 'var(--color-surface2)',
                    color: digit ? '#000' : 'var(--color-text)',
                    fontSize: 22, fontWeight: 800, textAlign: 'center',
                    outline: 'none', cursor: 'text',
                    boxShadow: digit ? '0 0 0 2px var(--color-primary)' : 'none',
                    transition: 'all 0.15s',
                  }}
                />
              ))}
            </div>

            <button
              onClick={handle2FA}
              disabled={otp.join('').length < 6 || loading}
              style={primaryBtn(otp.join('').length < 6 || loading)}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        )}
      </div>

      {/* Bottom: Terms */}
      <div style={{ padding: '16px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-muted)', fontSize: 12, lineHeight: 1.5 }}>
          By continuing, you agree to our{' '}
          <a href="/pages/terms" style={{ color: 'var(--color-primary)',
                                          textDecoration: 'none' }}>Terms</a>
          {' '}and{' '}
          <a href="/pages/privacy-policy" style={{ color: 'var(--color-primary)',
                                                    textDecoration: 'none' }}>Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
