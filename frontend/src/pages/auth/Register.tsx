import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { authAPI, otpAPI } from '../../services/api';
import { useStore } from '../../store/useStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Zap, ArrowLeft, Check } from 'lucide-react';

type Step = 'identifier' | 'otp' | 'password';

// ── Save referral code to cookie ──────────────────
const saveReferralCookie = (code: string) => {
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `vdx_ref=${code};expires=${expires};path=/`;
};

const getReferralFromCookie = (): string => {
  const match = document.cookie.match(/vdx_ref=([^;]+)/);
  return match ? match[1] : '';
};

export default function Register() {
  const [searchParams]  = useSearchParams();
  const [step, setStep] = useState<Step>('identifier');

  // Identifier state
  const [rawInput, setRawInput]     = useState('');
  const [isPhone, setIsPhone]       = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNum, setPhoneNum]     = useState('');
  const [showCountry, setShowCountry] = useState(false);

  // OTP state
  const [otp, setOtp]       = useState(['','','','','','']);
  const [resendSec, setResendSec] = useState(120);
  const otpRefs             = useRef<(HTMLInputElement|null)[]>([]);
  const timerRef            = useRef<any>(null);

  // Password state
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [showReferral, setShowReferral] = useState(false);

  const [loading, setLoading] = useState(false);
  const { setUser } = useStore();
  const navigate    = useNavigate();

  // ── Init: referral from URL or cookie ─────────
  useEffect(() => {
    const urlRef = searchParams.get('ref') || searchParams.get('referral');
    const cookieRef = getReferralFromCookie();
    const ref = urlRef || cookieRef;
    if (ref) {
      setReferralCode(ref);
      if (urlRef) saveReferralCookie(urlRef);
    }
  }, []);

  // ── Detect email vs phone ─────────────────────
  useEffect(() => {
    const digits = rawInput.replace(/\D/g,'');
    // If 4+ digits and no @ → phone mode
    if (digits.length >= 4 && !rawInput.includes('@') && /^\d+$/.test(rawInput)) {
      setIsPhone(true);
      setPhoneNum(digits);
    } else {
      setIsPhone(false);
      setPhoneNum('');
    }
  }, [rawInput]);

  const identifier = isPhone
    ? countryCode.replace('+','') + phoneNum
    : rawInput.toLowerCase();

  const displayIdentifier = isPhone
    ? `${countryCode} ${phoneNum}`
    : rawInput;

  const isValid = isPhone ? phoneNum.length >= 8 : (rawInput.includes('@') && rawInput.length > 6);

  // ── Resend timer ───────────────────────────────
  const startTimer = () => {
    setResendSec(120);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendSec(s => {
        if (s <= 1) { clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  // ── Step 1: Check + Send OTP ──────────────────
  const handleContinue = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      // Check if already registered
      const checkRes: any = await otpAPI.check(isPhone ? phoneNum : rawInput);
      if (checkRes.data.exists) {
        toast.error('Account already exists. Please login.');
        setLoading(false);
        return;
      }

      // Send OTP
      const sendRes: any = await otpAPI.send(
        isPhone ? identifier : rawInput,
        'register'
      );

      if (!sendRes.data.sent) {
        toast.error('Failed to send OTP');
        setLoading(false);
        return;
      }

      toast.success(isPhone ? 'OTP sent to your phone' : 'OTP sent to your email');
      setStep('otp');
      startTimer();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally { setLoading(false); }
  };

  // ── Step 2: Verify OTP ────────────────────────
  const handleVerifyOTP = async (codeOverride?: string) => {
    const code = codeOverride || otp.join('');
    if (code.length < 6 || loading) return;
    setLoading(true);
    try {
      const res: any = await otpAPI.verify(
        isPhone ? identifier : rawInput,
        code,
        'register'
      );
      if (!res.data.verified) {
        toast.error('Invalid OTP');
        setLoading(false);
        return;
      }
      setStep('password');
    } catch (err: any) {
      toast.error(err?.message || 'Invalid OTP');
      setOtp(['','','','','','']);
      otpRefs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  // OTP box handler
  const handleOtpChange = (i: number, val: string) => {
    const v = val.replace(/\D/g,'').slice(-1);
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) otpRefs.current[i+1]?.focus();
    if (next.join('').length === 6) {
      setTimeout(() => handleVerifyOTP(next.join('')), 100);
    }
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i-1]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendSec > 0) return;
    setLoading(true);
    try {
      await otpAPI.send(isPhone ? identifier : rawInput, 'register');
      toast.success('OTP resent');
      startTimer();
      setOtp(['','','','','','']);
      otpRefs.current[0]?.focus();
    } catch (e) {
      toast.error('Failed to resend');
    } finally { setLoading(false); }
  };

  // ── Step 3: Set Password + Register ──────────
  // Password validation checks
  const pwChecks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Contains uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Contains number', ok: /\d/.test(password) },
  ];
  const pwValid = pwChecks.every(c => c.ok);

  const handleRegister = async () => {
    if (!pwValid || loading) return;
    setLoading(true);
    try {
      const regData: any = {
        password,
        referral_code: referralCode || undefined,
      };

      if (isPhone) {
        regData.phone = phoneNum;
      } else {
        regData.email = rawInput.toLowerCase();
      }

      const res: any = await authAPI.register(regData);
      setUser(res.data.user, res.data.access_token);
      toast.success('Account created! Welcome 🎉');
      navigate('/home');
    } catch (err: any) {
      toast.error(err?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  // ── Styles ────────────────────────────────────
  const inp = {
    padding: '16px', borderRadius: 12,
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

  // Country codes list
  const countries = [
    { code: '+91', flag: '🇮🇳', name: 'India' },
    { code: '+1',  flag: '🇺🇸', name: 'USA' },
    { code: '+44', flag: '🇬🇧', name: 'UK' },
    { code: '+971', flag: '🇦🇪', name: 'UAE' },
    { code: '+65', flag: '🇸🇬', name: 'Singapore' },
    { code: '+61', flag: '🇦🇺', name: 'Australia' },
    { code: '+49', flag: '🇩🇪', name: 'Germany' },
    { code: '+33', flag: '🇫🇷', name: 'France' },
    { code: '+81', flag: '🇯🇵', name: 'Japan' },
    { code: '+86', flag: '🇨🇳', name: 'China' },
  ];

  const selectedCountry = countries.find(c => c.code === countryCode) || countries[0];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)',
                  display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {step !== 'identifier' ? (
            <button onClick={() => {
              if (step === 'password') setStep('otp');
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
        <Link to="/login" style={{
          padding: '8px 16px', borderRadius: 20,
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)', textDecoration: 'none',
          fontSize: 14, fontWeight: 600
        }}>Log in</Link>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 24px 40px',
                    maxWidth: 440, width: '100%', margin: '0 auto' }}>

        {/* ── Step 1: Identifier ── */}
        {step === 'identifier' && (
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8,
                         color: 'var(--color-text)' }}>Create account</h1>
            <p style={{ color: 'var(--color-muted)', fontSize: 15,
                        marginBottom: 32 }}>
              Enter your email or phone number
            </p>

            {/* Smart Input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: 'var(--color-muted)', fontSize: 13,
                              display: 'block', marginBottom: 8 }}>
                Email / Phone
              </label>

              {!isPhone ? (
                // Email input
                <input
                  autoFocus
                  value={rawInput}
                  onChange={e => setRawInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && isValid && handleContinue()}
                  placeholder="Email or phone number"
                  style={{ ...inp, width: '100%' }}
                />
              ) : (
                // Phone input with country code
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* Country selector */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowCountry(!showCountry)}
                      style={{
                        ...inp, display: 'flex', alignItems: 'center',
                        gap: 6, cursor: 'pointer', border: 'none',
                        width: 100, justifyContent: 'center', whiteSpace: 'nowrap'
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{selectedCountry.flag}</span>
                      <span style={{ fontSize: 14 }}>{countryCode}</span>
                      <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>▼</span>
                    </button>

                    {showCountry && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, zIndex: 100,
                        background: 'var(--color-surface)', borderRadius: 12,
                        border: '1px solid var(--color-border)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        minWidth: 200, maxHeight: 280, overflowY: 'auto'
                      }}>
                        {countries.map(c => (
                          <div key={c.code}
                            onClick={() => { setCountryCode(c.code); setShowCountry(false); }}
                            style={{
                              padding: '12px 16px', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 10,
                              background: countryCode === c.code ? 'var(--color-surface2)' : 'none'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = countryCode === c.code ? 'var(--color-surface2)' : 'none')}
                          >
                            <span style={{ fontSize: 20 }}>{c.flag}</span>
                            <span style={{ fontSize: 14, color: 'var(--color-text)' }}>{c.name}</span>
                            <span style={{ fontSize: 13, color: 'var(--color-muted)',
                                           marginLeft: 'auto' }}>{c.code}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Phone number input */}
                  <input
                    autoFocus
                    value={rawInput}
                    onChange={e => setRawInput(e.target.value.replace(/\D/g,''))}
                    onKeyDown={e => e.key === 'Enter' && isValid && handleContinue()}
                    placeholder="Phone number"
                    type="text"
                    inputMode="numeric"
                    style={{ ...inp, flex: 1 }}
                  />
                </div>
              )}
            </div>

            {/* Referral Code */}
            <div style={{ marginBottom: 24 }}>
              <button
                onClick={() => setShowReferral(!showReferral)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-primary)', fontSize: 14,
                  display: 'flex', alignItems: 'center', gap: 4, padding: 0
                }}
              >
                Referral code (optional)
                <span style={{ fontSize: 10 }}>{showReferral ? '▲' : '▼'}</span>
              </button>

              {showReferral && (
                <input
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="Enter referral code"
                  style={{ ...inp, width: '100%', marginTop: 8 }}
                />
              )}

              {referralCode && !showReferral && (
                <div style={{ marginTop: 6, fontSize: 13,
                              color: 'var(--color-success)',
                              display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Check size={14} />
                  Referral code applied: {referralCode}
                </div>
              )}
            </div>

            <button
              onClick={handleContinue}
              disabled={!isValid || loading}
              style={primaryBtn(!isValid || loading)}
            >
              {loading ? 'Checking...' : 'Continue'}
            </button>

            <p style={{ color: 'var(--color-muted)', fontSize: 12,
                        textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
              By creating an account, you agree to our{' '}
              <a href="/pages/terms" style={{ color: 'var(--color-primary)',
                                              textDecoration: 'none' }}>Terms of Use</a>
            </p>
          </div>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 'otp' && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8,
                         color: 'var(--color-text)' }}>You're almost there</h1>
            <p style={{ color: 'var(--color-muted)', fontSize: 15,
                        marginBottom: 4 }}>
              Enter the 6-digit code sent to
            </p>
            <p style={{ color: 'var(--color-text)', fontWeight: 700,
                        fontSize: 15, marginBottom: 32 }}>
              {displayIdentifier}
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
                    width: 48, height: 56, borderRadius: 12,
                    border: '2px solid ' + (digit ? 'var(--color-primary)' : 'var(--color-border)'),
                    background: digit ? '#f0b90b15' : 'var(--color-surface2)',
                    color: 'var(--color-text)',
                    fontSize: 22, fontWeight: 800, textAlign: 'center',
                    outline: 'none', cursor: 'text',
                    transition: 'all 0.15s',
                  }}
                />
              ))}
            </div>

            <button
              onClick={() => handleVerifyOTP()}
              disabled={otp.join('').length < 6 || loading}
              style={primaryBtn(otp.join('').length < 6 || loading)}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>

            {/* Resend */}
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button
                onClick={handleResend}
                disabled={resendSec > 0}
                style={{
                  background: 'none', border: 'none',
                  color: resendSec > 0 ? 'var(--color-muted)' : 'var(--color-primary)',
                  cursor: resendSec > 0 ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 500
                }}
              >
                {resendSec > 0 ? `Resend (${resendSec}s)` : 'Resend OTP'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Password ── */}
        {step === 'password' && (
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8,
                         color: 'var(--color-text)' }}>Set Password</h1>
            <p style={{ color: 'var(--color-muted)', fontSize: 15,
                        marginBottom: 28 }}>
              Create a strong password for your account
            </p>

            <div style={{ position: 'relative', marginBottom: 20 }}>
              <input
                autoFocus
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && pwValid && handleRegister()}
                placeholder="Create password"
                style={{ ...inp, width: '100%', paddingRight: 48 }}
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

            {/* Password checks */}
            {password.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                {pwChecks.map(check => (
                  <div key={check.label} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 6, transition: 'all 0.2s'
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: check.ok ? 'var(--color-success)' : 'var(--color-surface2)',
                      border: `2px solid ${check.ok ? 'var(--color-success)' : 'var(--color-border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s', flexShrink: 0
                    }}>
                      {check.ok && <Check size={10} color="#000" strokeWidth={3} />}
                    </div>
                    <span style={{
                      fontSize: 13,
                      color: check.ok ? 'var(--color-success)' : 'var(--color-muted)',
                      transition: 'color 0.2s'
                    }}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleRegister}
              disabled={!pwValid || loading}
              style={primaryBtn(!pwValid || loading)}
            >
              {loading ? 'Creating account...' : 'Create Account 🎉'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
