import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI, marketAPI, transferAPI } from '../../services/api';
import {
  ArrowLeft, Search, X, ChevronRight, AlertTriangle,
  Check, Shield, Mail, Repeat, Send, Coins
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
        background: 'var(--color-surface)', borderRadius: '20px 20px 0 0',
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

// Network visual config (logo/color) - lookup by short_name
// Eligibility/list comes dynamically from backend (coin-networks API)
const NETWORK_VISUALS: Record<string, { logo: string; color: string }> = {
  BSC:     { logo: 'https://bin.bnbstatic.com/image/admin_mgs_image_upload/20201110/87496d50-2408-43e1-ad4c-78b47b448a6a.png', color: '#F3BA2F' },
  ETH:     { logo: 'https://bin.bnbstatic.com/image/admin_mgs_image_upload/20201110/3a8c9fe6-2a76-4ace-aa07-415d994de6b5.png', color: '#627EEA' },
  VDCHAIN: { logo: 'https://vdscan.io/logo.png', color: '#f0b90b' },
  TRX:     { logo: 'https://cryptologos.cc/logos/tron-trx-logo.png', color: '#FF060A' },
  BTC:     { logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png', color: '#F7931A' },
  SOL:     { logo: 'https://cryptologos.cc/logos/solana-sol-logo.png', color: '#9945FF' },
};
const getNetworkVisual = (shortName?: string) =>
  (shortName && NETWORK_VISUALS[shortName]) || { logo: '', color: 'var(--color-primary)' };

export default function Withdraw() {
  const navigate = useNavigate();

  // Flow: coin → form(withdraw/transfer) → otp → success
  const [step, setStep] = useState<'coin'|'form'|'otp'|'success'>('coin');
  const [activeTab, setActiveTab] = useState<'withdraw'|'transfer'>('withdraw');

  // Coins
  const [coins, setCoins]       = useState<any[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);

  // Withdraw
  const [selectedCoin, setSelectedCoin]     = useState<any>(null);
  const [withdrawInfo, setWithdrawInfo]     = useState<any>(null);
  const [address, setAddress]               = useState('');
  const [amount, setAmount]                 = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<any>(null);
  const [coinNetworks, setCoinNetworks]     = useState<any[]>([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [showNetworkSheet, setShowNetworkSheet] = useState(false);
  const [result, setResult]                 = useState<any>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // OTP
  const [emailOtp, setEmailOtp]   = useState(['','','','','','']);
  const [totpCode, setTotpCode]   = useState(['','','','','','']);
  const [resendSec, setResendSec] = useState(0);

  // Internal Transfer
  const [tfCoins, setTfCoins]           = useState<any[]>([]);
  const [tfSelectedCoin, setTfSelectedCoin] = useState<any>(null);
  const [showCoinSheet, setShowCoinSheet]   = useState(false);
  const [tfCoinSearch, setTfCoinSearch]     = useState('');
  const [tfIdentifier, setTfIdentifier]     = useState('');
  const [tfUser, setTfUser]                 = useState<any>(null);
  const [tfAmount, setTfAmount]             = useState('');
  const [tfLoading, setTfLoading]           = useState(false);
  const [tfSuccess, setTfSuccess]           = useState<any>(null);
  const [tfEmailOtp, setTfEmailOtp]         = useState(['','','','','','']);
  const [tfTotpCode, setTfTotpCode]         = useState(['','','','','','']);
  const [tfStep, setTfStep]                 = useState<'form'|'otp'>('form');
  const [tfResendSec, setTfResendSec]       = useState(0);

  const otpEmailRefs = Array.from({ length: 6 }, () => null) as any[];
  const otpTotpRefs  = Array.from({ length: 6 }, () => null) as any[];
  const tfEmailRefs  = Array.from({ length: 6 }, () => null) as any[];
  const tfTotpRefs   = Array.from({ length: 6 }, () => null) as any[];

  useEffect(() => {
    marketAPI.getCoins().then((res: any) => {
      const all = res.data || [];
      setCoins(all.filter((c: any) => c.is_withdraw));
      setTfCoins(all);
    });
  }, []);

  const filtered = coins.filter(c =>
    !search ||
    c.symbol?.toLowerCase().includes(search.toLowerCase()) ||
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const tfFilteredCoins = tfCoins.filter(c =>
    !tfCoinSearch ||
    c.symbol?.toLowerCase().includes(tfCoinSearch.toLowerCase()) ||
    c.name?.toLowerCase().includes(tfCoinSearch.toLowerCase())
  );

  // Coin select -> fetch which networks THIS coin actually supports for withdrawal
  const handleCoinSelect = async (coin: any) => {
    setSelectedCoin(coin);
    setSelectedNetwork(null);
    setWithdrawInfo(null);
    setNetworksLoading(true);
    setCoinNetworks([]);
    try {
      const res: any = await walletAPI.getCoinNetworks(coin.symbol);
      const list = ((res as any)?.data || res || []).filter((n: any) => n.is_withdraw_enabled);
      setCoinNetworks(list);
      if (list.length === 1) {
        // Only one network supported - auto-select it and fetch withdraw info directly
        await handleNetworkSelect(coin, list[0]);
      } else if (list.length === 0) {
        toast.error(`No networks available for ${coin.symbol} withdrawal`);
      } else {
        // Multiple networks - go to form view AND open the network picker
        // immediately, since withdrawInfo is empty until a network is chosen
        setStep('form');
        setActiveTab('withdraw');
        setShowNetworkSheet(true);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load networks');
    } finally { setNetworksLoading(false); }
  };

  // Network select (or auto-select when only one) -> fetch withdraw info for that pair
  const handleNetworkSelect = async (coin: any, network: any) => {
    setSelectedNetwork(network);
    setShowNetworkSheet(false);
    setLoading(true);
    try {
      const res: any = await walletAPI.getWithdrawInfo(coin.symbol, network.network);
      setWithdrawInfo(res.data);
      setStep('form');
      setActiveTab('withdraw');
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
      const idemKey = 'WD-' + Date.now() + '-' + Math.random().toString(36).substr(2,9);
      setIdempotencyKey(idemKey);
      await walletAPI.sendWithdrawalOTP();
      setStep('otp');
      startTimer(setResendSec);
      toast.success('OTP sent to your email!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const startTimer = (setter: any) => {
    setter(120);
    const t = setInterval(() => {
      setter((s: number) => { if (s <= 1) { clearInterval(t); return 0; } return s - 1; });
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
    if (withdrawInfo?.two_fa_enabled && totpStr.length < 6) { toast.error('Enter 2FA code'); return; }
    setLoading(true);
    try {
      const res: any = await walletAPI.requestWithdrawal({
        coin: selectedCoin.symbol, network: selectedNetwork?.network,
        amount, address, email_otp: emailCode,
        totp_code: withdrawInfo?.two_fa_enabled ? totpStr : undefined,
        idempotency_key: idempotencyKey,
      });
      setResult(res.data);
      setStep('success');
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally { setLoading(false); }
  };

  // Transfer handlers
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

  const handleTfContinue = async () => {
    if (!tfSelectedCoin) { toast.error('Select coin'); return; }
    if (!tfUser) { toast.error('Find recipient first'); return; }
    if (!tfAmount || parseFloat(tfAmount) <= 0) { toast.error('Enter amount'); return; }
    setTfLoading(true);
    try {
      await walletAPI.sendWithdrawalOTP();
      setTfStep('otp');
      startTimer(setTfResendSec);
      toast.success('OTP sent to your email!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send OTP');
    } finally { setTfLoading(false); }
  };

  const handleTfSubmit = async () => {
    const emailCode = tfEmailOtp.join('');
    if (emailCode.length < 6) { toast.error('Enter complete email OTP'); return; }
    setTfLoading(true);
    try {
      const res: any = await transferAPI.internal({
        coin: tfSelectedCoin.symbol, amount: tfAmount,
        to_identifier: tfIdentifier,
        email_otp: emailCode,
        totp_code: tfTotpCode.join('') || undefined,
      });
      setTfSuccess(res.data);
      toast.success('Transfer successful!');
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
    if (step === 'success') { navigate('/assets'); return; }
    if (step === 'otp') {
      setStep('form'); setEmailOtp(['','','','','','']); setTotpCode(['','','','','','']); return;
    }
    if (step === 'form') {
      if (activeTab === 'transfer' && tfStep === 'otp') {
        setTfStep('form'); setTfEmailOtp(['','','','','','']); return;
      }
      setStep('coin'); setSelectedCoin(null); setWithdrawInfo(null);
      setAddress(''); setAmount(''); return;
    }
    navigate(-1);
  };

  const headerTitle = () => {
    if (step === 'success') return '';
    if (step === 'coin')    return 'Select Crypto';
    if (step === 'otp')     return 'Verify Withdrawal';
    if (step === 'form')    return `Withdraw ${selectedCoin?.symbol || ''}`;
    return 'Withdraw';
  };

  // ── SUCCESS PAGE — no header/footer ──────────────
  if (step === 'success' && result) {
    return (
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
                  <button onClick={() => {
                    navigator.clipboard.writeText(result.tx_id);
                    toast.success('Copied!');
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer',
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

        <button onClick={() => navigate('/assets')} style={{
          width: '100%', padding: '16px', borderRadius: 14, border: 'none',
          background: 'var(--color-primary)', color: '#000',
          fontWeight: 700, cursor: 'pointer', fontSize: 15
        }}>Back to Assets</button>
      </div>
    );
  }

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

      {/* ── STEP: Coin Select (no tabs) ── */}
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
                                  fontWeight: 800, color: 'var(--color-primary)', fontSize: 15 }}>
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

      {/* ── STEP: Form (Withdraw + Transfer tabs) ── */}
      {step === 'form' && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)',
                        flexShrink: 0 }}>
            {[
              { key: 'withdraw', label: 'Withdraw', icon: <Send size={13} /> },
              { key: 'transfer', label: 'Send to User', icon: <Repeat size={13} /> },
            ].map((t: any) => (
              <button key={t.key} onClick={() => {
                setActiveTab(t.key);
                setTfStep('form');
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

          {/* ── WITHDRAW TAB ── */}
          {activeTab === 'withdraw' && !withdrawInfo && !networksLoading && (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ color: 'var(--color-muted)', fontSize: 14, marginBottom: 16 }}>
                Select a network to continue
              </div>
              <button onClick={() => setShowNetworkSheet(true)} style={{
                padding: '12px 24px', borderRadius: 12, border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-text)',
                fontWeight: 600, cursor: 'pointer', fontSize: 14
              }}>
                Choose Network →
              </button>
            </div>
          )}

          {activeTab === 'withdraw' && withdrawInfo && (
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
                <div onClick={() => setShowNetworkSheet(true)} style={{
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

              <button onClick={handleContinue} disabled={loading} style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: loading ? 'var(--color-surface)' : 'var(--color-primary)',
                color: loading ? 'var(--color-muted)' : '#000',
                fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
              }}>
                {loading ? 'Sending OTP...' : 'Continue →'}
              </button>
            </div>
          )}

          {/* ── TRANSFER TAB ── */}
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
                    Sent Successfully!
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 8 }}>
                    {tfAmount} {tfSelectedCoin?.symbol} sent to
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 24 }}>
                    {tfUser?.name} ({tfUser?.uid})
                  </div>
                  <button onClick={() => {
                    setTfSuccess(null); setTfUser(null); setTfIdentifier('');
                    setTfAmount(''); setTfSelectedCoin(null); setTfStep('form');
                    setTfEmailOtp(['','','','','','']);
                  }} style={{
                    padding: '14px 32px', borderRadius: 14, border: 'none',
                    background: 'var(--color-primary)', color: '#000',
                    fontWeight: 700, cursor: 'pointer', fontSize: 15
                  }}>Send Again</button>
                </div>
              ) : tfStep === 'form' ? (
                // Transfer form
                <>
                  {/* Coin selector */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
                      Coin
                    </div>
                    <div onClick={() => setShowCoinSheet(true)} style={{
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
                        onKeyDown={e => e.key === 'Enter' && handleLookup()} />
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

                  <button onClick={handleTfContinue} disabled={tfLoading} style={{
                    width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                    background: tfLoading ? 'var(--color-surface)' : 'var(--color-primary)',
                    color: tfLoading ? 'var(--color-muted)' : '#000',
                    fontWeight: 700, cursor: tfLoading ? 'not-allowed' : 'pointer', fontSize: 15
                  }}>
                    {tfLoading ? 'Sending OTP...' : 'Continue →'}
                  </button>
                </>
              ) : (
                // Transfer OTP verify
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
                      {tfEmailOtp.map((digit, i) => (
                        <input key={i} ref={el => { tfEmailRefs[i] = el; }}
                          value={digit} maxLength={1} type="tel"
                          onChange={e => handleOtpChange(tfEmailOtp, setTfEmailOtp, tfEmailRefs, i, e.target.value)}
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
                      <button onClick={async () => {
                        if (tfResendSec > 0) return;
                        await walletAPI.sendWithdrawalOTP();
                        toast.success('OTP resent!');
                        startTimer(setTfResendSec);
                        setTfEmailOtp(['','','','','','']);
                      }} style={{
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

                  <button onClick={handleTfSubmit} disabled={tfLoading} style={{
                    width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                    background: tfLoading ? 'var(--color-surface)' : 'var(--color-primary)',
                    color: tfLoading ? 'var(--color-muted)' : '#000',
                    fontWeight: 700, cursor: tfLoading ? 'not-allowed' : 'pointer', fontSize: 15
                  }}>
                    {tfLoading ? 'Sending...' : 'Confirm Transfer'}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ── STEP: OTP Verify (Withdraw) ── */}
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
                startTimer(setResendSec);
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

          {/* 2FA */}
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

          <button onClick={handleSubmit} disabled={loading} style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: loading ? 'var(--color-surface)' : 'var(--color-danger)',
            color: loading ? 'var(--color-muted)' : '#fff',
            fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
          }}>
            {loading ? 'Processing...' : 'Confirm Withdrawal'}
          </button>
        </div>
      )}

      {/* Network Sheet - dynamic, per-coin */}
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
          {networksLoading && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-muted)', fontSize: 13 }}>
              Loading networks...
            </div>
          )}
          {!networksLoading && coinNetworks.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-muted)', fontSize: 13 }}>
              No withdrawal networks available for {selectedCoin?.symbol}
            </div>
          )}
          {!networksLoading && coinNetworks.map((net: any) => {
            const visual = getNetworkVisual(net.network);
            const isSelected = selectedNetwork?.network === net.network;
            return (
              <div key={net.network} onClick={() => handleNetworkSelect(selectedCoin, net)}
                style={{ display: 'flex', alignItems: 'center', gap: 12,
                         padding: '14px 16px', borderRadius: 14, marginBottom: 10,
                         background: isSelected ? visual.color + '15' : 'var(--color-surface)',
                         border: '1px solid ' + (isSelected ? visual.color : 'var(--color-border)'),
                         cursor: 'pointer' }}>
                <img src={visual.logo} alt={net.network}
                  style={{ width: 38, height: 38, borderRadius: '50%' }}
                  onError={(e) => { (e.target as any).style.display = 'none'; }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{net.network_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 2 }}>
                    ~{net.min_confirmations} confirmations
                  </div>
                </div>
                {isSelected && <Check size={18} color={visual.color} />}
              </div>
            );
          })}
        </div>
      </BottomSheet>

      {/* Coin Sheet for Transfer */}
      <BottomSheet open={showCoinSheet}
        onClose={() => setShowCoinSheet(false)} height="75vh">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 20px 12px', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Select Coin</span>
          <button onClick={() => setShowCoinSheet(false)} style={{
            background: 'var(--color-surface2)', border: 'none', cursor: 'pointer',
            borderRadius: '50%', width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}><X size={16} color="var(--color-muted)" /></button>
        </div>
        <div style={{ padding: '0 16px 10px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                        background: 'var(--color-surface2)', borderRadius: 12,
                        padding: '10px 14px', border: '1px solid var(--color-border)' }}>
            <Search size={14} color="var(--color-muted)" />
            <input value={tfCoinSearch} onChange={e => setTfCoinSearch(e.target.value)}
              placeholder="Search..." autoFocus
              style={{ flex: 1, background: 'none', border: 'none',
                       color: 'var(--color-text)', fontSize: 14, outline: 'none' }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tfFilteredCoins.map((coin: any) => (
            <div key={coin.symbol}
              onClick={() => { setTfSelectedCoin(coin); setShowCoinSheet(false); setTfCoinSearch(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12,
                       padding: '12px 16px', cursor: 'pointer',
                       borderBottom: '1px solid var(--color-border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {coin.logo_url
                ? <img src={coin.logo_url} alt=""
                    style={{ width: 36, height: 36, borderRadius: '50%' }} />
                : <div style={{ width: 36, height: 36, borderRadius: '50%',
                                background: 'var(--color-surface2)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, color: 'var(--color-primary)', fontSize: 13 }}>
                    {coin.symbol?.charAt(0)}
                  </div>
              }
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{coin.symbol}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{coin.name}</div>
              </div>
              {tfSelectedCoin?.symbol === coin.symbol && (
                <Check size={16} color="var(--color-success)" style={{ marginLeft: 'auto' }} />
              )}
            </div>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}