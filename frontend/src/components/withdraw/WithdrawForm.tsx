import { AlertTriangle, ChevronRight, Check, Shield, Mail } from 'lucide-react';
import { getNetworkVisual } from './NetworkAndCoinSheets';

const inp: any = {
  width: '100%', padding: '14px 16px', borderRadius: 12,
  border: '1px solid var(--color-border)', background: 'var(--color-surface)',
  color: 'var(--color-text)', fontSize: 15, outline: 'none', boxSizing: 'border-box'
};

// ── Placeholder shown when no network has been picked yet ──
export const NoNetworkSelected = ({ onChooseNetwork }: any) => (
  <div style={{ padding: '60px 20px', textAlign: 'center' }}>
    <div style={{ color: 'var(--color-muted)', fontSize: 14, marginBottom: 16 }}>
      Select a network to continue
    </div>
    <button onClick={onChooseNetwork} style={{
      padding: '12px 24px', borderRadius: 12, border: '1px solid var(--color-border)',
      background: 'var(--color-surface)', color: 'var(--color-text)',
      fontWeight: 600, cursor: 'pointer', fontSize: 14
    }}>
      Choose Network →
    </button>
  </div>
);

// ── Main withdraw form (network/address/amount/fee) ──
export const WithdrawForm = ({
  selectedCoin, selectedNetwork, withdrawInfo, address, setAddress,
  amount, setAmount, feeQty, receiveAmt, loading, onChooseNetwork, onContinue
}: any) => (
  <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>

    {/* Warning */}
    <div style={{ padding: '12px 14px', borderRadius: 12, marginBottom: 20,
                  background: '#f0b90b10', border: '1px solid #f0b90b25',
                  display: 'flex', gap: 10 }}>
      <AlertTriangle size={16} color="#f0b90b" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
        Only send to <strong style={{ color: 'var(--color-text)' }}>
          {selectedNetwork?.network_name || selectedNetwork?.name}
        </strong> address. Wrong network = permanent loss!
      </div>
    </div>

    {/* Network */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>Network</div>
      <div onClick={onChooseNetwork} style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        borderRadius: 12, cursor: 'pointer', background: 'var(--color-surface)',
        border: '1px solid var(--color-border)'
      }}>
        <img src={getNetworkVisual(selectedNetwork?.network).logo} alt=""
          style={{ width: 28, height: 28, borderRadius: '50%' }}
          onError={(e) => { (e.target as any).style.display = 'none'; }} />
        <span style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>
          {selectedNetwork?.network_name || selectedNetwork?.name}
        </span>
        <ChevronRight size={16} color="var(--color-muted)" />
      </div>
    </div>

    {/* Address */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
        Withdrawal Address
      </div>
      <input value={address} onChange={e => setAddress(e.target.value)}
        placeholder="Enter wallet address" style={inp} />
    </div>

    {/* Amount */}
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
        <span>Amount</span>
        <span>Available: <strong style={{ color: 'var(--color-text)' }}>
          {parseFloat(withdrawInfo.available||0).toFixed(6)} {selectedCoin?.symbol}
        </strong></span>
      </div>
      <div style={{ position: 'relative' }}>
        <input value={amount} onChange={e => setAmount(e.target.value)}
          type="number" placeholder="0.00"
          style={{ ...inp, paddingRight: 60 }} />
        <button onClick={() => {
          const max = Math.min(withdrawInfo.available, withdrawInfo.max_amount);
          setAmount((max - feeQty).toFixed(6));
        }} style={{ position: 'absolute', right: 12, top: '50%',
                     transform: 'translateY(-50%)', background: 'none', border: 'none',
                     cursor: 'pointer', color: 'var(--color-primary)',
                     fontSize: 13, fontWeight: 700 }}>MAX</button>
      </div>
    </div>

    <div style={{ display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, color: 'var(--color-muted)', marginBottom: 20 }}>
      <span>Min: {withdrawInfo.min_amount} {selectedCoin?.symbol}</span>
      <span>Max: {withdrawInfo.max_amount} {selectedCoin?.symbol}</span>
    </div>

    {/* Fee */}
    <div style={{ padding: '14px 16px', borderRadius: 12, marginBottom: 20,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)' }}>
      {[
        { label: 'Amount', value: `${parseFloat(amount||'0').toFixed(6)} ${selectedCoin?.symbol}` },
        { label: `Fee`, value: `${feeQty.toFixed(6)} ${selectedCoin?.symbol}` },
        { label: 'You Receive', value: `${receiveAmt.toFixed(6)} ${selectedCoin?.symbol}`, green: true },
      ].map(({ label, value, green }: any) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                                  padding: '6px 0', fontSize: 13 }}>
          <span style={{ color: 'var(--color-muted)' }}>{label}</span>
          <span style={{ color: green ? 'var(--color-success)' : 'var(--color-text)',
                         fontWeight: green ? 700 : 500 }}>{value}</span>
        </div>
      ))}
    </div>

    <button onClick={onContinue} disabled={loading} style={{
      width: '100%', padding: '16px', borderRadius: 14, border: 'none',
      background: loading ? 'var(--color-surface)' : 'var(--color-primary)',
      color: loading ? 'var(--color-muted)' : '#000',
      fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
    }}>
      {loading ? 'Sending OTP...' : 'Continue →'}
    </button>
  </div>
);

// ── OTP Verify step (Withdraw) ──
export const WithdrawOtpStep = ({
  selectedCoin, selectedNetwork, address, amount, feeQty, receiveAmt,
  withdrawInfo, emailOtp, setEmailOtp, totpCode, setTotpCode,
  otpEmailRefs, otpTotpRefs, resendSec, onResendOtp, onOtpChange,
  loading, onSubmit
}: any) => (
  <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 28,
                  lineHeight: 1.6, textAlign: 'center' }}>
      OTP sent to your registered email.<br />
      Enter below to confirm withdrawal.
    </div>

    {/* Email OTP */}
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
        <Mail size={16} color="var(--color-primary)" />
        <span>Email OTP</span>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {emailOtp.map((digit: string, i: number) => (
          <input key={i} ref={el => { otpEmailRefs[i] = el; }}
            value={digit} maxLength={1} type="tel"
            onChange={e => onOtpChange(emailOtp, setEmailOtp, otpEmailRefs, i, e.target.value)}
            onKeyDown={e => { if (e.key === 'Backspace' && !emailOtp[i] && i > 0) otpEmailRefs[i-1]?.focus(); }}
            style={{
              width: 46, height: 54, borderRadius: 12, textAlign: 'center',
              border: '2px solid ' + (digit ? 'var(--color-primary)' : 'var(--color-border)'),
              background: digit ? '#f0b90b15' : 'var(--color-surface)',
              color: 'var(--color-text)', fontSize: 22, fontWeight: 800, outline: 'none'
            }} />
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <button onClick={onResendOtp} style={{
          background: 'none', border: 'none',
          cursor: resendSec > 0 ? 'not-allowed' : 'pointer',
          color: resendSec > 0 ? 'var(--color-muted)' : 'var(--color-primary)',
          fontSize: 13, fontWeight: 500
        }}>
          {resendSec > 0 ? `Resend (${resendSec}s)` : 'Resend OTP'}
        </button>
      </div>
    </div>

    {/* 2FA */}
    {withdrawInfo?.two_fa_enabled && (
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                      marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
          <Shield size={16} color="var(--color-success)" />
          <span>Google Authenticator Code</span>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {totpCode.map((digit: string, i: number) => (
            <input key={i} ref={el => { otpTotpRefs[i] = el; }}
              value={digit} maxLength={1} type="tel"
              onChange={e => onOtpChange(totpCode, setTotpCode, otpTotpRefs, i, e.target.value)}
              onKeyDown={e => { if (e.key === 'Backspace' && !totpCode[i] && i > 0) otpTotpRefs[i-1]?.focus(); }}
              style={{
                width: 46, height: 54, borderRadius: 12, textAlign: 'center',
                border: '2px solid ' + (digit ? 'var(--color-success)' : 'var(--color-border)'),
                background: digit ? '#0ecb8115' : 'var(--color-surface)',
                color: 'var(--color-text)', fontSize: 22, fontWeight: 800, outline: 'none'
              }} />
          ))}
        </div>
      </div>
    )}

    {/* Summary */}
    <div style={{ padding: '14px 16px', borderRadius: 12, marginBottom: 24,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)' }}>
      {[
        { label: 'Coin',       value: selectedCoin?.symbol },
        { label: 'Network',    value: selectedNetwork?.network_name || selectedNetwork?.name },
        { label: 'To',         value: address.slice(0,8) + '...' + address.slice(-6) },
        { label: 'Amount',     value: `${parseFloat(amount).toFixed(6)} ${selectedCoin?.symbol}` },
        { label: 'Fee',        value: `${feeQty.toFixed(6)} ${selectedCoin?.symbol}` },
        { label: 'You Receive', value: `${receiveAmt.toFixed(6)} ${selectedCoin?.symbol}` },
      ].map(({ label, value }) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                                  padding: '6px 0', fontSize: 13,
                                  borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ color: 'var(--color-muted)' }}>{label}</span>
          <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{value}</span>
        </div>
      ))}
    </div>

    <button onClick={onSubmit} disabled={loading} style={{
      width: '100%', padding: '16px', borderRadius: 14, border: 'none',
      background: loading ? 'var(--color-surface)' : 'var(--color-danger)',
      color: loading ? 'var(--color-muted)' : '#fff',
      fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
    }}>
      {loading ? 'Processing...' : 'Confirm Withdrawal'}
    </button>
  </div>
);

// ── Success page (no header/footer, full screen) ──
export const WithdrawSuccess = ({ result, selectedNetwork, selectedCoin, address, onBack }: any) => (
  <div style={{ background: 'var(--color-bg)', minHeight: '100vh',
                display: 'flex', flexDirection: 'column',
                padding: '48px 20px 32px' }}>

    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%',
                    background: '#0ecb8115', border: '2px solid var(--color-success)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px' }}>
        <Check size={40} color="var(--color-success)" />
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
        Withdrawal Submitted
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
        {result.status === 'processing' ? 'Being processed automatically' : 'Pending admin approval'}
      </div>
    </div>

    {/* Amount */}
    <div style={{ textAlign: 'center', padding: '20px', borderRadius: 16,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)', marginBottom: 20 }}>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>You sent</div>
      <div style={{ fontSize: 34, fontWeight: 800 }}>
        {result.amount}{' '}
        <span style={{ color: 'var(--color-muted)', fontSize: 18 }}>{selectedCoin?.symbol}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 6 }}>
        Recipient receives:{' '}
        <strong style={{ color: 'var(--color-success)' }}>
          {result.receive_amount} {selectedCoin?.symbol}
        </strong>
      </div>
    </div>

    {/* Details */}
    <div style={{ background: 'var(--color-surface)', borderRadius: 14,
                  border: '1px solid var(--color-border)',
                  overflow: 'hidden', marginBottom: 20, flex: 1 }}>
      {[
        { label: 'Transaction ID', value: result.tx_id, mono: true, copy: true },
        { label: 'Network',        value: selectedNetwork?.network_name || selectedNetwork?.name },
        { label: 'To Address',     value: address?.slice(0,8) + '...' + address?.slice(-6), mono: true },
        { label: 'Amount',         value: `${result.amount} ${selectedCoin?.symbol}` },
        { label: 'Network Fee',    value: `${parseFloat(result.fee||0).toFixed(6)} ${selectedCoin?.symbol}` },
        { label: 'You Receive',    value: `${result.receive_amount} ${selectedCoin?.symbol}`, green: true },
        { label: 'Date',           value: new Date().toLocaleString('en-IN', {
            day:'2-digit', month:'short', year:'numeric',
            hour:'2-digit', minute:'2-digit' }) },
        { label: 'Status',
          value: result.status === 'processing' ? 'Auto Processing' : 'Pending Approval',
          color: result.status === 'processing' ? 'var(--color-success)' : 'var(--color-warning)' },
      ].map(({ label, value, mono, green, color, copy }: any) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                                  alignItems: 'center', padding: '12px 16px',
                                  borderBottom: '1px solid var(--color-border)', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--color-muted)', flexShrink: 0 }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: mono ? 11 : 13, fontWeight: 600,
              fontFamily: mono ? 'monospace' : 'inherit',
              color: green ? 'var(--color-success)' : color || 'var(--color-text)',
              textAlign: 'right', wordBreak: mono ? 'break-all' : 'normal'
            }}>{value}</span>
            {copy && (
              <button onClick={() => navigator.clipboard.writeText(result.tx_id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                         color: 'var(--color-muted)', display: 'flex', padding: 2 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>

    <div style={{ padding: '10px 14px', borderRadius: 12, marginBottom: 20,
                  background: '#1890ff10', border: '1px solid #1890ff25',
                  fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.6 }}>
      Blockchain TX Hash will be available after on-chain confirmation.
      You will receive an email notification.
    </div>

    <button onClick={onBack} style={{
      width: '100%', padding: '16px', borderRadius: 14, border: 'none',
      background: 'var(--color-primary)', color: '#000',
      fontWeight: 700, cursor: 'pointer', fontSize: 15
    }}>Back to Assets</button>
  </div>
);
