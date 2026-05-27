import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI, twoFAAPI } from '../../services/api';
import { useStore } from '../../store/useStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Zap, Shield } from 'lucide-react';

const GOOGLE_AUTH_URL = 'http://84.247.139.193:4005/api/v1/auth/google';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [otp, setOtp] = useState('');
  const { setUser } = useStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res: any = await authAPI.login(form);
      if (res.data.requires_2fa) {
        setTempToken(res.data.temp_token);
        setTwoFAStep(true);
        toast('Enter your 2FA code', { icon: '🔐' });
      } else {
        setUser(res.data.user, res.data.access_token);
        toast.success('Login successful!');
        navigate('/home');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) { toast.error('Enter 6-digit code'); return; }
    setLoading(true);
    try {
      const res: any = await twoFAAPI.loginVerify(tempToken, otp);
      setUser(res.data.user, res.data.access_token);
      toast.success('Login successful!');
      navigate('/home');
    } catch (err: any) {
      toast.error(err?.message || 'Invalid code');
    } finally { setLoading(false); }
  };

  const inp: any = {
    width: '100%', padding: '12px 16px', borderRadius: 10,
    background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
                        background: 'var(--color-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {twoFAStep ? <Shield size={28} color="#000" /> : <Zap size={28} color="#000" />}
          </div>
          <h1 style={{ color: 'var(--color-text)', fontSize: 24, fontWeight: 700, margin: 0 }}>
            {twoFAStep ? '2FA Verification' : 'VDExchange'}
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 14, marginTop: 4 }}>
            {twoFAStep ? 'Enter your authenticator code' : 'Login to your account'}
          </p>
        </div>

        <div style={{ background: 'var(--color-surface)', borderRadius: 16,
                      padding: 24, border: '1px solid var(--color-border)' }}>

          {twoFAStep ? (
            <form onSubmit={handle2FAVerify}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ color: 'var(--color-muted)', fontSize: 13,
                                display: 'block', marginBottom: 6 }}>6-Digit Code</label>
                <input value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000" type="tel" maxLength={6} autoFocus
                  style={{ ...inp, textAlign: 'center', fontSize: 24,
                           fontWeight: 700, letterSpacing: 10 }} />
                <div style={{ fontSize: 12, color: 'var(--color-muted)',
                              textAlign: 'center', marginTop: 6 }}>
                  From Google Authenticator app
                </div>
              </div>

              <button type="submit" disabled={loading || otp.length < 6} style={{
                width: '100%', padding: 13, borderRadius: 10, border: 'none',
                background: (loading || otp.length < 6)
                  ? 'var(--color-border)' : 'var(--color-primary)',
                color: '#000', fontSize: 15, fontWeight: 700,
                cursor: (loading || otp.length < 6) ? 'not-allowed' : 'pointer'
              }}>
                {loading ? 'Verifying...' : 'Verify'}
              </button>

              <button type="button" onClick={() => { setTwoFAStep(false); setOtp(''); }}
                style={{ width: '100%', padding: 10, marginTop: 8, borderRadius: 10,
                         border: 'none', background: 'none',
                         color: 'var(--color-muted)', cursor: 'pointer', fontSize: 13 }}>
                Back to Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: 'var(--color-muted)', fontSize: 13,
                                display: 'block', marginBottom: 6 }}>Email</label>
                <input type="email" required value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="Enter your email" style={inp} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ color: 'var(--color-muted)', fontSize: 13,
                                display: 'block', marginBottom: 6 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} required
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Enter password"
                    style={{ ...inp, paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--color-muted)'
                  }}>
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: 13, borderRadius: 10, border: 'none',
                background: loading ? 'var(--color-border)' : 'var(--color-primary)',
                color: '#000', fontSize: 15, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}>
                {loading ? 'Logging in...' : 'Login'}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center',
                            gap: 10, margin: '16px 0' }}>
                <div style={{ flex: 1, height: 1,
                              background: 'var(--color-border)' }} />
                <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>OR</span>
                <div style={{ flex: 1, height: 1,
                              background: 'var(--color-border)' }} />
              </div>

              {/* Google Login */}
              <a href={GOOGLE_AUTH_URL} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 10, padding: '12px', borderRadius: 10, textDecoration: 'none',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface2)',
                color: 'var(--color-text)', fontSize: 14, fontWeight: 600
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </a>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>
                  No account?{' '}
                </span>
                <Link to="/register"
                  style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: 14 }}>
                  Register
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
