import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { twoFAAPI } from '../../services/api';
import { ChevronLeft, Shield, Copy, Check, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TwoFA() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'status'|'setup'|'verify'|'backup'|'disable'>('status');
  const [status, setStatus] = useState<any>(null);
  const [setupData, setSetupData] = useState<any>(null);
  const [otp, setOtp] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    twoFAAPI.getStatus().then((res: any) => setStatus(res.data));
  }, []);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const res: any = await twoFAAPI.setup();
      setSetupData(res.data);
      setStep('setup');
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    if (otp.length < 6) { toast.error('Enter 6-digit code'); return; }
    setLoading(true);
    try {
      const res: any = await twoFAAPI.verify(otp);
      setBackupCodes(res.data.backup_codes);
      setStep('backup');
      toast.success('2FA Enabled!');
    } catch (err: any) {
      toast.error(err?.message || 'Invalid code');
    } finally { setLoading(false); }
  };

  const handleDisable = async () => {
    if (otp.length < 6) { toast.error('Enter 6-digit code'); return; }
    setLoading(true);
    try {
      await twoFAAPI.disable(otp);
      toast.success('2FA Disabled');
      setStatus({ is_enabled: false });
      setStep('status');
      setOtp('');
    } catch (err: any) {
      toast.error(err?.message || 'Invalid code');
    } finally { setLoading(false); }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(setupData?.manual_entry || '');
    setCopied(true);
    toast.success('Secret copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const inp: any = {
    width: '100%', padding: '14px', borderRadius: 10, textAlign: 'center',
    border: '2px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 22, outline: 'none',
    letterSpacing: 8, fontWeight: 700, boxSizing: 'border-box'
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => step === 'status' ? navigate(-1) : setStep('status')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
          Google Authenticator
        </span>
      </div>

      <div style={{ padding: 16 }}>

        {/* STATUS */}
        {step === 'status' && (
          <div>
            <div style={{ textAlign: 'center', padding: '32px 0 24px' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px',
                            background: status?.is_enabled
                              ? 'rgba(14,203,129,0.15)' : 'rgba(240,185,11,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={40} color={status?.is_enabled ? 'var(--color-success)' : 'var(--color-warning)'} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
                {status?.is_enabled ? '2FA is Enabled ✅' : '2FA is Disabled'}
              </div>
              <div style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.6 }}>
                {status?.is_enabled
                  ? 'Your account is protected with Google Authenticator'
                  : 'Add an extra layer of security to your account'}
              </div>
            </div>

            {/* How it works */}
            {!status?.is_enabled && (
              <div style={{ padding: '14px 16px', borderRadius: 12, marginBottom: 20,
                            background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 10, fontSize: 14 }}>
                  How to setup:
                </div>
                {[
                  '1. Install Google Authenticator app',
                  '2. Scan QR code from this page',
                  '3. Enter 6-digit code to verify',
                  '4. Save backup codes safely',
                ].map(s => (
                  <div key={s} style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 5 }}>{s}</div>
                ))}
              </div>
            )}

            {status?.is_enabled ? (
              <button onClick={() => { setStep('disable'); setOtp(''); }} style={{
                width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--color-danger)',
                background: 'rgba(246,70,93,0.08)', color: 'var(--color-danger)',
                fontWeight: 700, cursor: 'pointer', fontSize: 15
              }}>Disable 2FA</button>
            ) : (
              <button onClick={handleSetup} disabled={loading} style={{
                width: '100%', padding: 14, borderRadius: 12, border: 'none',
                background: loading ? 'var(--color-border)' : 'var(--color-primary)',
                color: '#000', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
              }}>
                {loading ? 'Setting up...' : 'Enable 2FA'}
              </button>
            )}
          </div>
        )}

        {/* SETUP - Show QR */}
        {step === 'setup' && setupData && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
                Scan with Google Authenticator
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                Open the app and scan this QR code
              </div>
            </div>

            {/* QR Code */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ padding: 16, background: '#fff', borderRadius: 16,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                <img src={setupData.qr_code} alt="2FA QR" style={{ width: 180, height: 180 }} />
              </div>
            </div>

            {/* Manual entry */}
            <div style={{ padding: '14px 16px', borderRadius: 12, marginBottom: 20,
                          background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>
                Can't scan? Enter manually:
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text)', wordBreak: 'break-all',
                            fontFamily: 'monospace', marginBottom: 8, letterSpacing: 1 }}>
                {setupData.manual_entry}
              </div>
              <button onClick={copySecret} style={{
                padding: '6px 14px', borderRadius: 8,
                background: copied ? 'var(--color-success)' : 'var(--color-surface2)',
                border: '1px solid var(--color-border)',
                color: copied ? '#fff' : 'var(--color-text)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Secret</>}
              </button>
            </div>

            <button onClick={() => setStep('verify')} style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: 'var(--color-primary)', color: '#000',
              fontWeight: 700, cursor: 'pointer', fontSize: 15
            }}>
              I've scanned → Enter Code
            </button>
          </div>
        )}

        {/* VERIFY OTP */}
        {step === 'verify' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
                Enter 6-digit code
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                From your Google Authenticator app
              </div>
            </div>

            <input
              value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000" type="tel" maxLength={6}
              style={inp} autoFocus
            />

            <div style={{ fontSize: 12, color: 'var(--color-muted)', textAlign: 'center',
                          marginTop: 8, marginBottom: 24 }}>
              Code refreshes every 30 seconds
            </div>

            <button onClick={handleVerify} disabled={loading || otp.length < 6} style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: (loading || otp.length < 6) ? 'var(--color-border)' : 'var(--color-primary)',
              color: '#000', fontWeight: 700,
              cursor: (loading || otp.length < 6) ? 'not-allowed' : 'pointer', fontSize: 15
            }}>
              {loading ? 'Verifying...' : 'Verify & Enable 2FA'}
            </button>

            <button onClick={() => setStep('setup')} style={{
              width: '100%', padding: 12, borderRadius: 12, marginTop: 10,
              border: '1px solid var(--color-border)', background: 'none',
              color: 'var(--color-muted)', cursor: 'pointer', fontSize: 14
            }}>← Back to QR Code</button>
          </div>
        )}

        {/* BACKUP CODES */}
        {step === 'backup' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <CheckCircle size={48} color="var(--color-success)" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>
                2FA Enabled! 🎉
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6 }}>
                Save these backup codes. Use them if you lose access to your authenticator app.
              </div>
            </div>

            {/* Warning */}
            <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16,
                          background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-danger)', fontWeight: 600 }}>
                ⚠️ Save these codes now! They won't be shown again.
              </div>
            </div>

            {/* Codes grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {backupCodes.map((code, i) => (
                <div key={i} style={{ padding: '10px 14px', borderRadius: 8,
                                       background: 'var(--color-surface)',
                                       border: '1px solid var(--color-border)',
                                       fontFamily: 'monospace', fontSize: 14,
                                       color: 'var(--color-text)', textAlign: 'center',
                                       fontWeight: 600, letterSpacing: 2 }}>
                  {code}
                </div>
              ))}
            </div>

            <button onClick={() => {
              navigator.clipboard.writeText(backupCodes.join('\n'));
              toast.success('All backup codes copied!');
            }} style={{
              width: '100%', padding: 12, borderRadius: 12, marginBottom: 10,
              border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
              color: 'var(--color-text)', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}>
              <Copy size={16} /> Copy All Codes
            </button>

            <button onClick={() => { setStatus({ is_enabled: true }); navigate('/security'); }} style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: 'var(--color-primary)', color: '#000',
              fontWeight: 700, cursor: 'pointer', fontSize: 15
            }}>Done ✓</button>
          </div>
        )}

        {/* DISABLE */}
        {step === 'disable' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
                Disable 2FA
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                Enter your authenticator code to confirm
              </div>
            </div>

            <input
              value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000" type="tel" maxLength={6}
              style={inp} autoFocus
            />

            <button onClick={handleDisable} disabled={loading || otp.length < 6} style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none', marginTop: 20,
              background: (loading || otp.length < 6) ? 'var(--color-border)' : 'var(--color-danger)',
              color: '#fff', fontWeight: 700,
              cursor: (loading || otp.length < 6) ? 'not-allowed' : 'pointer', fontSize: 15
            }}>
              {loading ? 'Disabling...' : 'Confirm Disable 2FA'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
