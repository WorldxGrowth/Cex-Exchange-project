import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Zap, Eye, EyeOff } from 'lucide-react';

type Step = 'email' | 'otp' | 'newpass';

export default function ForgotPassword() {
  const navigate  = useNavigate();
  const [step, setStep]         = useState<Step>('email');
  const [email, setEmail]       = useState('');
  const [otp, setOtp]           = useState('');
  const [newPass, setNewPass]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);

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
  });

  // Step 1: Send OTP
  const handleSendOTP = async () => {
    if (!email || loading) return;
    setLoading(true);
    try {
      await authAPI.forgotPassword(email.toLowerCase().trim());
      toast.success('OTP sent to your email!');
      setStep('otp');
    } catch (err: any) {
      toast.error(err?.message || 'Email not found');
    } finally { setLoading(false); }
  };

  // Step 2: Verify OTP → go to new password
  const handleVerifyOTP = () => {
    if (otp.length < 6) { toast.error('Enter 6-digit OTP'); return; }
    setStep('newpass');
  };

  // Step 3: Reset password
  const handleReset = async () => {
    if (!newPass || loading) return;
    if (newPass.length < 8) { toast.error('Password must be 8+ characters'); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword({
        email: email.toLowerCase().trim(),
        otp,
        new_password: newPass
      });
      toast.success('Password reset! Please login.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err?.message || 'Failed. Check OTP.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)',
                  display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => step === 'email' ? navigate('/login') : setStep(step === 'newpass' ? 'otp' : 'email')}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
                   color: 'var(--color-text)', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <div style={{ width: 32, height: 32, borderRadius: 8,
                      background: 'var(--color-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={18} color="#000" />
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 24px 40px',
                    maxWidth: 440, width: '100%', margin: '0 auto' }}>

        {/* Step 1: Email */}
        {step === 'email' && (
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8,
                         color: 'var(--color-text)' }}>Forgot Password</h1>
            <p style={{ color: 'var(--color-muted)', fontSize: 15, marginBottom: 32 }}>
              Enter your email to receive a reset OTP
            </p>
            <div style={{ marginBottom: 16 }}>
              <input autoFocus value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
                placeholder="Email address" style={inp} />
            </div>
            <button onClick={handleSendOTP} disabled={!email || loading}
              style={primaryBtn(!email || loading)}>
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </div>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8,
                         color: 'var(--color-text)' }}>Enter OTP</h1>
            <p style={{ color: 'var(--color-muted)', fontSize: 15, marginBottom: 8 }}>
              OTP sent to
            </p>
            <div style={{ padding: '8px 14px', borderRadius: 10, marginBottom: 28,
                          background: 'var(--color-surface2)', display: 'inline-block' }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{email}</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <input autoFocus value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
                onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
                placeholder="6-digit OTP" maxLength={6} type="tel"
                style={{ ...inp, fontSize: 24, letterSpacing: 8, textAlign: 'center' }} />
            </div>
            <button onClick={handleVerifyOTP} disabled={otp.length < 6}
              style={primaryBtn(otp.length < 6)}>
              Verify OTP
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={() => { setStep('email'); setOtp(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                         color: 'var(--color-primary)', fontSize: 14 }}>
                Resend OTP
              </button>
            </div>
          </div>
        )}

        {/* Step 3: New Password */}
        {step === 'newpass' && (
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8,
                         color: 'var(--color-text)' }}>New Password</h1>
            <p style={{ color: 'var(--color-muted)', fontSize: 15, marginBottom: 32 }}>
              Set your new password (min 8 characters)
            </p>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input autoFocus
                type={showPass ? 'text' : 'password'}
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                placeholder="New password"
                style={{ ...inp, paddingRight: 48 }} />
              <button onClick={() => setShowPass(!showPass)} style={{
                position: 'absolute', right: 14, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-muted)', display: 'flex'
              }}>
                {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <button onClick={handleReset} disabled={!newPass || loading}
              style={primaryBtn(!newPass || loading)}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
