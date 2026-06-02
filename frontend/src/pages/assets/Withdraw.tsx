import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI, marketAPI, otpAPI, twoFAAPI, transferAPI } from '../../services/api';
import {
  ArrowLeft, Search, X, ChevronRight, AlertTriangle,
  Check, Shield, Mail, Repeat, Send
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Bottom Sheet ──────────────────────────────────
const BottomSheet = ({ open, onClose, children, height = '55vh' }: any) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999,
                  background: 'rgba(0,0,0,0.65)',
                  display: 'flex', flexDirection: 'column',
                  justifyContent: 'flex-end' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--color-surface)',
        borderRadius: '20px 20px 0 0',
        height, display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center',
                      padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2,
                        background: 'var(--color-border)' }} />
        </div>
        {children}
      </div>
    </div>
  );
};

const NETWORKS = [
  { id: 'BSC',     name: 'BNB Smart Chain (BSC)', color: '#F3BA2F',
    logo: 'https://bin.bnbstatic.com/image/admin_mgs_image_upload/20201110/87496d50-2408-43e1-ad4c-78b47b448a6a.png' },
  { id: 'ETH',     name: 'Ethereum (ERC20)',       color: '#627EEA',
    logo: 'https://bin.bnbstatic.com/image/admin_mgs_image_upload/20201110/3a8c9fe6-2a76-4ace-aa07-415d994de6b5.png' },
  { id: 'VDCHAIN', name: 'VDChain Network',        color: '#f0b90b',
    logo: 'https://vdscan.io/favicon.ico' },
];

export default function Withdraw() {
  const navigate  = useNavigate();

  // Tabs
  const [activeTab, setActiveTab] = useState<'withdraw'|'transfer'>('withdraw');

  // Withdraw states
  const [step, setStep]                   = useState<'coin'|'form'|'otp'|'success'>('coin');
  const [coins, setCoins]                 = useState<any[]>([]);
  const [selectedCoin, setSelectedCoin]   = useState<any>(null);
  const [withdrawInfo, setWithdrawInfo]   = useState<any>(null);
  const [search, setSearch]               = useState('');
  const [address, setAddress]             = useState('');
  const [amount, setAmount]               = useState('');
  const [showNetworkSheet, setShowNetworkSheet] = useState(false);
  const [selectedNetwork, setSelectedNetwork]   = useState<any>(NETWORKS[0]);
  const [loading, setLoading]             = useState(false);
  const [result, setResult]               = useState<any>(null);

  // OTP states
  const [emailOtp, setEmailOtp]           = useState(['','','','','','']);
  const [totpCode, setTotpCode]           = useState(['','','','','','']);
  const [otpSent, setOtpSent]             = useState(false);
  const [resendSec, setResendSec]         = useState(0);

  // Transfer states
  const [tfCoin, setTfCoin]               = useState('USDT');
  const [tfAmount, setTfAmount]           = useState('');
  const [tfFromAcc, setTfFromAcc]         = useState('spot');
  const [tfToAcc, setTfToAcc]             = useState('futures');
  const [tfIdentifier, setTfIdentifier]   = useState('');
  const [tfUser, setTfUser]               = useState<any>(null);
  const [tfType, setTfType]               = useState<'accounts'|'internal'>('accounts');
  const [tfLoading, setTfLoading]         = useState(false);
  const [tfSuccess, setTfSuccess]         = useState<any>(null);

  const otpEmailRefs = Array.from({ length: 6 }, () => null) as any[];
  const otpTotpRefs  = Array.from({ length: 6 }, () => null) as any[];

  useEffect(() => {
    marketAPI.getCoins().then((res: any) => {
      setCoins((res.data || []).filter((c: any) => c.is_withdraw));
    });
  }, []);

  const filtered = coins.filter(c =>
    !search ||
    c.symbol?.toLowerCase().includes(search.toLowerCase()) ||
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCoinSelect = async (coin: any) => {
    setSelectedCoin(coin);
    setLoading(true);
    try {
      const res: any = await walletAPI.getWithdrawInfo(coin.symbol);
      setWithdrawInfo(res.data);
      setStep('form');
    } catch (err: any) {
      toast.error(err?.message || 'Withdrawals disabled');
    } finally { setLoading(false); }
  };

  const feeQty    = withdrawInfo?.fee_qty || 0;
  const receiveAmt = Math.max(0, parseFloat(amount || '0') - feeQty);

  const handleContinue = async () => {
    if (!address) { toast.error('Enter withdrawal address'); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error('Enter amount'); return; }
    if (parseFloat(amount) < withdrawInfo.min_amount)
      { toast.error(`Min: ${withdrawInfo.min_amount} ${selectedCoin.symbol}`); return; }
    if (parseFloat(amount) > withdrawInfo.available)
      { toast.error('Insufficient balance'); return; }

    setLoading(true);
    try {
      await walletAPI.sendWithdrawalOTP();
      setOtpSent(true);
      setStep('otp');
      startResendTimer();
      toast.success('OTP sent to your email!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const startResendTimer = () => {
    setResendSec(120);
    const t = setInterval(() => {
      setResendSec(s => { if (s <= 1) { clearInterval(t); return 0; } return s - 1; });
    }, 1000);
  };

  const handleOtpChange = (arr: string[], setArr: any, refs: any[], i: number, val: string) => {
    const v = val.replace(/\D/g,'').slice(-1);
    const next = [...arr]; next[i] = v; setArr(next);
    if (v && i < 5) refs[i+1]?.focus();
  };

  const handleSubmit = async () => {
    const emailCode = emailOtp.join('');
    if (emailCode.length < 6) { toast.error('Enter complete email OTP'); return; }

    const totpStr = totpCode.join('');
    if (withdrawInfo?.two_fa_enabled && totpStr.length < 6)
      { toast.error('Enter 2FA code'); return; }

    setLoading(true);
    try {
      const res: any = await walletAPI.requestWithdrawal({
        coin:       selectedCoin.symbol,
        network:    selectedNetwork.id,
        amount,
        address,
        email_otp:  emailCode,
        totp_code:  withdrawInfo?.two_fa_enabled ? totpStr : undefined,
      });
      setResult(res.data);
      setStep('success');
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally { setLoading(false); }
  };

  // Transfer lookup
  const handleLookup = async () => {
    if (!tfIdentifier) return;
    try {
      const res: any = await transferAPI.lookup(tfIdentifier);
      setTfUser(res.data);
    } catch (err: any) {
      toast.error(err?.message || 'User not found');
      setTfUser(null);
    }
  };

  const handleTransfer = async () => {
    if (!tfAmount || parseFloat(tfAmount) <= 0) { toast.error('Enter amount'); return; }
    setTfLoading(true);
    try {
      let res: any;
      if (tfType === 'accounts') {
        res = await transferAPI.between({
          coin: tfCoin, amount: tfAmount,
          from_account: tfFromAcc, to_account: tfToAcc
        });
      } else {
        if (!tfUser) { toast.error('Search user first'); setTfLoading(false); return; }
        res = await transferAPI.internal({
          coin: tfCoin, amount: tfAmount, to_identifier: tfIdentifier
        });
      }
      setTfSuccess(res.data);
      toast.success(res.message || 'Transfer successful!');
    } catch (err: any) {
      toast.error(err?.message || 'Transfer failed');
    } finally { setTfLoading(false); }
  };

  const inp: any = {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
    color: 'var(--color-text)', fontSize: 15, outline: 'none', boxSizing: 'border-box'
  };

  const backStep = () => {
    if (step === 'otp') { setStep('form'); setEmailOtp(['','','','','','']); setTotpCode(['','','','','','']); }
    else if (step === 'form') { setStep('coin'); setSelectedCoin(null); setWithdrawInfo(null); }
    else navigate(-1);
  };

  const headerTitle = () => {
    if (activeTab === 'transfer') return 'Transfer';
    if (step === 'coin')    return 'Select Crypto';
    if (step === 'form')    return `Withdraw ${selectedCoin?.symbol}`;
    if (step === 'otp')     return 'Verify Withdrawal';
    if (step === 'success') return 'Submitted';
    return 'Withdraw';
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh',
                  display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12,
                    padding: '0 16px', height: 56, flexShrink: 0,
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={backStep} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>{headerTitle()}</span>
      </div>

      {/* Tab bar — Withdraw / Transfer */}
      <div style={{ display: 'flex', background: 'var(--color-bg)',
                    borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        {[
          { key: 'withdraw', label: 'Withdraw', icon: <Send size={14} /> },
          { key: 'transfer', label: 'Transfer', icon: <Repeat size={14} /> },
        ].map((t: any) => (
          <button key={t.key} onClick={() => {
            setActiveTab(t.key);
            if (t.key === 'withdraw') setStep('coin');
            setTfSuccess(null);
          }} style={{
            flex: 1, padding: '13px 8px', background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6,
            color: activeTab === t.key ? 'var(--color-text)' : 'var(--color-muted)',
            borderBottom: activeTab === t.key
              ? '2px solid var(--color-primary)' : '2px solid transparent',
            fontSize: 14, fontWeight: activeTab === t.key ? 700 : 500,
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══ WITHDRAW TAB ══ */}
      {activeTab === 'withdraw' && (
        <>
          {/* STEP: Coin Select */}
          {step === 'coin' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                              background: 'var(--color-surface)', borderRadius: 24,
                              padding: '11px 16px', border: '1px solid var(--color-border)' }}>
                  <Search size={15} color="var(--color-muted)" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search coin..." autoFocus
                    style={{ flex: 1, background: 'none', border: 'none',
                             color: 'var(--color-text)', fontSize: 15, outline: 'none' }} />
                  {search && <button onClick={() => setSearch('')} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-muted)', display: 'flex'
                  }}><X size={14} /></button>}
                </div>
              </div>

              <div style={{ padding: '4px 16px 8px', fontSize: 13, flexShrink: 0,
                            color: 'var(--color-muted)', fontWeight: 600 }}>
                All Coins
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filtered.map((coin: any) => (
                  <div key={coin.symbol} onClick={() => handleCoinSelect(coin)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12,
                             padding: '14px 16px', cursor: 'pointer',
                             borderBottom: '1px solid var(--color-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {coin.logo_url
                      ? <img src={coin.logo_url} alt=""
                          style={{ width: 40, height: 40, borderRadius: '50%' }} />
                      : <div style={{ width: 40, height: 40, borderRadius: '50%',
                                      background: 'var(--color-surface)', display: 'flex',
                                      alignItems: 'center', justifyContent: 'center',
                                      fontWeight: 800, color: 'var(--color-primary)' }}>
                          {coin.symbol?.charAt(0)}
                        </div>
                    }
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{coin.symbol}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                        {coin.name}
                      </div>
                    </div>
                    <ChevronRight size={16} color="var(--color-muted)" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP: Form */}
          {step === 'form' && withdrawInfo && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>

              {/* Warning */}
              <div style={{ padding: '12px 14px', borderRadius: 12, marginBottom: 20,
                            background: '#f0b90b10', border: '1px solid #f0b90b25',
                            display: 'flex', gap: 10 }}>
                <AlertTriangle size={16} color="#f0b90b" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                  Only send to <strong style={{ color: 'var(--color-text)' }}>
                    {selectedNetwork.name}
                  </strong> address. Wrong network = permanent loss!
                </div>
              </div>

              {/* Network selector */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
                  Network
                </div>
                <div onClick={() => setShowNetworkSheet(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)'
                }}>
                  <img src={selectedNetwork.logo} alt=""
                    style={{ width: 28, height: 28, borderRadius: '50%' }}
                    onError={(e) => { (e.target as any).style.display = 'none'; }} />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>
                    {selectedNetwork.name}
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
                    {parseFloat(withdrawInfo.available || 0).toFixed(6)} {selectedCoin?.symbol}
                  </strong></span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input value={amount} onChange={e => setAmount(e.target.value)}
                    type="number" placeholder="0.00"
                    style={{ ...inp, paddingRight: 60 }} />
                  <button onClick={() => {
                    const max = Math.min(withdrawInfo.available, withdrawInfo.max_amount);
                    setAmount((max - feeQty).toFixed(6));
                  }} style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)', background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--color-primary)', fontSize: 13, fontWeight: 700
                  }}>MAX</button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between',
                            fontSize: 12, color: 'var(--color-muted)', marginBottom: 20 }}>
                <span>Min: {withdrawInfo.min_amount} {selectedCoin?.symbol}</span>
                <span>Max: {withdrawInfo.max_amount} {selectedCoin?.symbol}</span>
              </div>

              {/* Fee breakdown */}
              <div style={{ padding: '14px 16px', borderRadius: 12, marginBottom: 20,
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)' }}>
                {[
                  { label: 'Amount', value: `${parseFloat(amount||'0').toFixed(6)} ${selectedCoin?.symbol}` },
                  { label: `Network Fee (${withdrawInfo.fee_type === 'fixed_usd' ? '$' + withdrawInfo.fee_fixed + ' USD' : 'fixed'})`,
                    value: `${feeQty.toFixed(6)} ${selectedCoin?.symbol}` },
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

              <button onClick={handleContinue} disabled={loading} style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: loading ? 'var(--color-surface2)' : 'var(--color-primary)',
                color: loading ? 'var(--color-muted)' : '#000',
                fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
              }}>
                {loading ? 'Sending OTP...' : 'Continue →'}
              </button>
            </div>
          )}

          {/* STEP: OTP Verify */}
          {step === 'otp' && (
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
                  {emailOtp.map((digit, i) => (
                    <input key={i} ref={el => { otpEmailRefs[i] = el; }}
                      value={digit} maxLength={1} type="tel"
                      onChange={e => handleOtpChange(emailOtp, setEmailOtp, otpEmailRefs, i, e.target.value)}
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
                  <button onClick={async () => {
                    if (resendSec > 0) return;
                    await walletAPI.sendWithdrawalOTP();
                    toast.success('OTP resent!');
                    startResendTimer();
                    setEmailOtp(['','','','','','']);
                  }} style={{
                    background: 'none', border: 'none',
                    cursor: resendSec > 0 ? 'not-allowed' : 'pointer',
                    color: resendSec > 0 ? 'var(--color-muted)' : 'var(--color-primary)',
                    fontSize: 13, fontWeight: 500
                  }}>
                    {resendSec > 0 ? `Resend (${resendSec}s)` : 'Resend OTP'}
                  </button>
                </div>
              </div>

              {/* 2FA (if enabled) */}
              {withdrawInfo?.two_fa_enabled && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                                marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
                    <Shield size={16} color="var(--color-success)" />
                    <span>Google Authenticator Code</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {totpCode.map((digit, i) => (
                      <input key={i} ref={el => { otpTotpRefs[i] = el; }}
                        value={digit} maxLength={1} type="tel"
                        onChange={e => handleOtpChange(totpCode, setTotpCode, otpTotpRefs, i, e.target.value)}
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
                  { label: 'Network',    value: selectedNetwork.name },
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

              <button onClick={handleSubmit} disabled={loading} style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: loading ? 'var(--color-surface2)' : 'var(--color-danger)',
                color: loading ? 'var(--color-muted)' : '#fff',
                fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
              }}>
                {loading ? 'Processing...' : 'Confirm Withdrawal'}
              </button>
            </div>
          )}

          {/* STEP: Success */}
          {step === 'success' && result && (
            <div style={{ flex: 1, padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%',
                            background: '#0ecb8115',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px' }}>
                <Check size={36} color="var(--color-success)" />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
                Withdrawal Submitted!
              </div>
              <div style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 24 }}>
                {result.message}
              </div>
              <div style={{ background: 'var(--color-surface)', borderRadius: 14,
                            border: '1px solid var(--color-border)',
                            padding: '16px', marginBottom: 24, textAlign: 'left' }}>
                {[
                  { label: 'TX ID',       value: result.tx_id },
                  { label: 'Amount',      value: `${result.amount} ${selectedCoin?.symbol}` },
                  { label: 'You Receive', value: `${result.receive_amount} ${selectedCoin?.symbol}` },
                  { label: 'Status',      value: result.status === 'processing' ? 'Auto Processing' : 'Pending Approval' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                                            padding: '8px 0', fontSize: 13,
                                            borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ color: 'var(--color-muted)' }}>{label}</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate('/assets')} style={{
                width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                background: 'var(--color-primary)', color: '#000',
                fontWeight: 700, cursor: 'pointer', fontSize: 15
              }}>Back to Assets</button>
            </div>
          )}
        </>
      )}

      {/* ══ TRANSFER TAB ══ */}
      {activeTab === 'transfer' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>

          {tfSuccess ? (
            // Transfer success
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%',
                            background: '#0ecb8115',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px' }}>
                <Check size={36} color="var(--color-success)" />
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
                Transfer Successful!
              </div>
              <div style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 24 }}>
                {tfAmount} {tfCoin} transferred
              </div>
              <button onClick={() => setTfSuccess(null)} style={{
                padding: '14px 32px', borderRadius: 14, border: 'none',
                background: 'var(--color-primary)', color: '#000',
                fontWeight: 700, cursor: 'pointer', fontSize: 15
              }}>Transfer Again</button>
            </div>
          ) : (
            <>
              {/* Transfer type tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[
                  { key: 'accounts', label: 'Account Transfer' },
                  { key: 'internal', label: 'Send to User' },
                ].map((t: any) => (
                  <button key={t.key} onClick={() => setTfType(t.key)} style={{
                    flex: 1, padding: '10px', borderRadius: 12, cursor: 'pointer',
                    border: '1px solid ' + (tfType === t.key ? 'var(--color-primary)' : 'var(--color-border)'),
                    background: tfType === t.key ? '#f0b90b15' : 'var(--color-surface)',
                    color: tfType === t.key ? 'var(--color-primary)' : 'var(--color-muted)',
                    fontSize: 13, fontWeight: 600
                  }}>{t.label}</button>
                ))}
              </div>

              {/* Coin */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>Coin</div>
                <input value={tfCoin} onChange={e => setTfCoin(e.target.value.toUpperCase())}
                  placeholder="e.g. USDT" style={inp} />
              </div>

              {tfType === 'accounts' ? (
                // Account transfer
                <>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>From</div>
                      <select value={tfFromAcc} onChange={e => setTfFromAcc(e.target.value)}
                        style={{ ...inp, padding: '12px' }}>
                        <option value="spot">Spot</option>
                        <option value="futures">Futures</option>
                        <option value="funding">Funding</option>
                      </select>
                    </div>
                    <button onClick={() => {
                      const tmp = tfFromAcc; setTfFromAcc(tfToAcc); setTfToAcc(tmp);
                    }} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                               borderRadius: 10, width: 36, height: 36, cursor: 'pointer',
                               display: 'flex', alignItems: 'center', justifyContent: 'center',
                               marginTop: 20, flexShrink: 0 }}>
                      <Repeat size={16} color="var(--color-primary)" />
                    </button>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>To</div>
                      <select value={tfToAcc} onChange={e => setTfToAcc(e.target.value)}
                        style={{ ...inp, padding: '12px' }}>
                        <option value="spot">Spot</option>
                        <option value="futures">Futures</option>
                        <option value="funding">Funding</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                // Internal transfer
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
                    Recipient (UID / Email / Phone)
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={tfIdentifier} onChange={e => setTfIdentifier(e.target.value)}
                      placeholder="Enter UID, email or phone"
                      style={{ ...inp, flex: 1 }} />
                    <button onClick={handleLookup} style={{
                      padding: '0 16px', borderRadius: 12, border: 'none',
                      background: 'var(--color-primary)', color: '#000',
                      fontWeight: 700, cursor: 'pointer', flexShrink: 0
                    }}>Find</button>
                  </div>
                  {tfUser && (
                    <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 12,
                                  background: '#0ecb8110', border: '1px solid #0ecb8130',
                                  display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%',
                                    background: 'var(--color-surface)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 800, color: 'var(--color-primary)' }}>
                        {tfUser.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{tfUser.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                          UID: {tfUser.uid} • {tfUser.email}
                        </div>
                      </div>
                      <Check size={18} color="var(--color-success)" style={{ marginLeft: 'auto' }} />
                    </div>
                  )}
                </div>
              )}

              {/* Amount */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>Amount</div>
                <input value={tfAmount} onChange={e => setTfAmount(e.target.value)}
                  type="number" placeholder="0.00" style={inp} />
              </div>

              <button onClick={handleTransfer} disabled={tfLoading} style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: tfLoading ? 'var(--color-surface2)' : 'var(--color-primary)',
                color: tfLoading ? 'var(--color-muted)' : '#000',
                fontWeight: 700, cursor: tfLoading ? 'not-allowed' : 'pointer', fontSize: 15
              }}>
                {tfLoading ? 'Transferring...' : 'Transfer'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Network Bottom Sheet */}
      <BottomSheet open={showNetworkSheet}
        onClose={() => setShowNetworkSheet(false)} height="50vh">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 20px 14px', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Select Network</span>
          <button onClick={() => setShowNetworkSheet(false)} style={{
            background: 'var(--color-surface2)', border: 'none', cursor: 'pointer',
            borderRadius: '50%', width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}><X size={16} color="var(--color-muted)" /></button>
        </div>

        <div style={{ margin: '0 16px 14px', padding: '10px 14px', borderRadius: 10,
                      background: '#f0b90b10', border: '1px solid #f0b90b25',
                      fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5, flexShrink: 0 }}>
          Only withdraw to addresses on the selected network!
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px' }}>
          {NETWORKS.map(net => (
            <div key={net.id} onClick={() => { setSelectedNetwork(net); setShowNetworkSheet(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12,
                       padding: '14px 16px', borderRadius: 14, marginBottom: 10,
                       background: selectedNetwork.id === net.id ? net.color + '15' : 'var(--color-surface)',
                       border: '1px solid ' + (selectedNetwork.id === net.id ? net.color : 'var(--color-border)'),
                       cursor: 'pointer' }}>
              <img src={net.logo} alt={net.id}
                style={{ width: 38, height: 38, borderRadius: '50%' }}
                onError={(e) => { (e.target as any).style.display = 'none'; }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{net.name}</div>
              </div>
              {selectedNetwork.id === net.id && <Check size={18} color={net.color} />}
            </div>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}