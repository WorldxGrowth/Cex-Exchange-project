import { ChevronRight, Check, Mail, Coins } from 'lucide-react';

const inp: any = {
  width: '100%', padding: '14px 16px', borderRadius: 12,
  border: '1px solid var(--color-border)', background: 'var(--color-surface)',
  color: 'var(--color-text)', fontSize: 15, outline: 'none', boxSizing: 'border-box'
};

export const TransferForm = ({
  tfSelectedCoin, onShowCoinSheet, tfIdentifier, setTfIdentifier,
  onLookup, tfUser, tfAmount, setTfAmount, tfLoading, onContinue
}: any) => (
  <>
    {/* Coin selector */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
        Coin
      </div>
      <div onClick={onShowCoinSheet} style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        borderRadius: 12, cursor: 'pointer', background: 'var(--color-surface)',
        border: '1px solid var(--color-border)'
      }}>
        {tfSelectedCoin ? (
          <>
            {tfSelectedCoin.logo_url
              ? <img src={tfSelectedCoin.logo_url} alt=""
                  style={{ width: 28, height: 28, borderRadius: '50%' }} />
              : <div style={{ width: 28, height: 28, borderRadius: '50%',
                              background: '#f0b90b20', display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              fontWeight: 800, color: 'var(--color-primary)', fontSize: 12 }}>
                  {tfSelectedCoin.symbol?.charAt(0)}
                </div>
            }
            <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
              {tfSelectedCoin.symbol}
            </span>
          </>
        ) : (
          <>
            <Coins size={20} color="var(--color-muted)" />
            <span style={{ flex: 1, color: 'var(--color-muted)', fontSize: 15 }}>
              Select coin
            </span>
          </>
        )}
        <ChevronRight size={16} color="var(--color-muted)" />
      </div>
    </div>

    {/* Recipient */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
        Recipient (UID / Email / Phone)
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={tfIdentifier} onChange={e => setTfIdentifier(e.target.value)}
          placeholder="Enter UID, email or phone"
          style={{ ...inp, flex: 1 }}
          onKeyDown={e => e.key === 'Enter' && onLookup()} />
        <button onClick={onLookup} style={{
          padding: '0 16px', borderRadius: 12, border: 'none',
          background: 'var(--color-primary)', color: '#000',
          fontWeight: 700, cursor: 'pointer', flexShrink: 0
        }}>Find</button>
      </div>
      {tfUser && (
        <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 12,
                      background: '#0ecb8110', border: '1px solid #0ecb8130',
                      display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%',
                        background: 'var(--color-surface)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, color: 'var(--color-primary)', fontSize: 15 }}>
            {tfUser.name?.charAt(0) || 'U'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{tfUser.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              UID: {tfUser.uid} • {tfUser.email}
            </div>
          </div>
          <Check size={18} color="var(--color-success)" />
        </div>
      )}
    </div>

    {/* Amount */}
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
        Amount
      </div>
      <input value={tfAmount} onChange={e => setTfAmount(e.target.value)}
        type="number" placeholder="0.00" style={inp} />
    </div>

    <button onClick={onContinue} disabled={tfLoading} style={{
      width: '100%', padding: '16px', borderRadius: 14, border: 'none',
      background: tfLoading ? 'var(--color-surface)' : 'var(--color-primary)',
      color: tfLoading ? 'var(--color-muted)' : '#000',
      fontWeight: 700, cursor: tfLoading ? 'not-allowed' : 'pointer', fontSize: 15
    }}>
      {tfLoading ? 'Sending OTP...' : 'Continue →'}
    </button>
  </>
);

export const TransferOtpStep = ({
  tfEmailOtp, setTfEmailOtp, tfEmailRefs, onOtpChange, tfResendSec, onResendOtp,
  tfSelectedCoin, tfUser, tfAmount, tfLoading, onSubmit
}: any) => (
  <>
    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 24,
                  lineHeight: 1.6, textAlign: 'center' }}>
      OTP sent to your registered email.<br />
      Enter below to confirm transfer.
    </div>

    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
        <Mail size={16} color="var(--color-primary)" />
        <span>Email OTP</span>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {tfEmailOtp.map((digit: string, i: number) => (
          <input key={i} ref={el => { tfEmailRefs[i] = el; }}
            value={digit} maxLength={1} type="tel"
            onChange={e => onOtpChange(tfEmailOtp, setTfEmailOtp, tfEmailRefs, i, e.target.value)}
            onKeyDown={e => { if (e.key === 'Backspace' && !tfEmailOtp[i] && i > 0) tfEmailRefs[i-1]?.focus(); }}
            style={{
              width: 46, height: 54, borderRadius: 12, textAlign: 'center',
              border: '2px solid ' + (digit ? 'var(--color-primary)' : 'var(--color-border)'),
              background: digit ? '#f0b90b15' : 'var(--color-surface)',
              color: 'var(--color-text)', fontSize: 22, fontWeight: 800, outline: 'none'
            }} />
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <button onClick={onResendOtp} style={{
          background: 'none', border: 'none',
          cursor: tfResendSec > 0 ? 'not-allowed' : 'pointer',
          color: tfResendSec > 0 ? 'var(--color-muted)' : 'var(--color-primary)',
          fontSize: 13
        }}>
          {tfResendSec > 0 ? `Resend (${tfResendSec}s)` : 'Resend OTP'}
        </button>
      </div>
    </div>

    {/* Summary */}
    <div style={{ padding: '14px 16px', borderRadius: 12, marginBottom: 24,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)' }}>
      {[
        { label: 'Coin',   value: tfSelectedCoin?.symbol },
        { label: 'To',     value: `${tfUser?.name} (${tfUser?.uid})` },
        { label: 'Amount', value: `${tfAmount} ${tfSelectedCoin?.symbol}` },
      ].map(({ label, value }) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                                  padding: '6px 0', fontSize: 13,
                                  borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ color: 'var(--color-muted)' }}>{label}</span>
          <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{value}</span>
        </div>
      ))}
    </div>

    <button onClick={onSubmit} disabled={tfLoading} style={{
      width: '100%', padding: '16px', borderRadius: 14, border: 'none',
      background: tfLoading ? 'var(--color-surface)' : 'var(--color-primary)',
      color: tfLoading ? 'var(--color-muted)' : '#000',
      fontWeight: 700, cursor: tfLoading ? 'not-allowed' : 'pointer', fontSize: 15
    }}>
      {tfLoading ? 'Sending...' : 'Confirm Transfer'}
    </button>
  </>
);

export const TransferSuccess = ({ tfAmount, tfSelectedCoin, tfUser, onSendAgain }: any) => (
  <div style={{ textAlign: 'center', padding: '40px 0' }}>
    <div style={{ width: 72, height: 72, borderRadius: '50%',
                  background: '#0ecb8115',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px' }}>
      <Check size={36} color="var(--color-success)" />
    </div>
    <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
      Sent Successfully!
    </div>
    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 8 }}>
      {tfAmount} {tfSelectedCoin?.symbol} sent to
    </div>
    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 24 }}>
      {tfUser?.name} ({tfUser?.uid})
    </div>
    <button onClick={onSendAgain} style={{
      padding: '14px 32px', borderRadius: 14, border: 'none',
      background: 'var(--color-primary)', color: '#000',
      fontWeight: 700, cursor: 'pointer', fontSize: 15
    }}>Send Again</button>
  </div>
);
