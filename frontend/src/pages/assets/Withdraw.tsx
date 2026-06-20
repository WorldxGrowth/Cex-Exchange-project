import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI, marketAPI, transferAPI } from '../../services/api';
import { ArrowLeft, Search, X, ChevronRight, Repeat, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { NetworkSheet, CoinSheet } from '../../components/withdraw/NetworkAndCoinSheets';
import { NoNetworkSelected, WithdrawForm, WithdrawOtpStep, WithdrawSuccess } from '../../components/withdraw/WithdrawForm';
import { TransferForm, TransferOtpStep, TransferSuccess } from '../../components/withdraw/TransferForm';

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
        await handleNetworkSelect(coin, list[0]);
      } else if (list.length === 0) {
        toast.error(`No networks available for ${coin.symbol} withdrawal`);
      } else {
        setStep('form');
        setActiveTab('withdraw');
        setShowNetworkSheet(true);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load networks');
    } finally { setNetworksLoading(false); }
  };

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

  if (step === 'success' && result) {
    return (
      <WithdrawSuccess result={result} selectedNetwork={selectedNetwork}
        selectedCoin={selectedCoin} address={address}
        onBack={() => navigate('/assets')} />
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

      {/* ── STEP: Coin Select ── */}
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
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)',
                        flexShrink: 0 }}>
            {[
              { key: 'withdraw', label: 'Withdraw', icon: <Send size={13} /> },
              { key: 'transfer', label: 'Send to User', icon: <Repeat size={13} /> },
            ].map((t: any) => (
              <button key={t.key} onClick={() => { setActiveTab(t.key); setTfStep('form'); }} style={{
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

          {activeTab === 'withdraw' && !withdrawInfo && !networksLoading && (
            <NoNetworkSelected onChooseNetwork={() => setShowNetworkSheet(true)} />
          )}

          {activeTab === 'withdraw' && withdrawInfo && (
            <WithdrawForm
              selectedCoin={selectedCoin} selectedNetwork={selectedNetwork}
              withdrawInfo={withdrawInfo} address={address} setAddress={setAddress}
              amount={amount} setAmount={setAmount} feeQty={feeQty} receiveAmt={receiveAmt}
              loading={loading} onChooseNetwork={() => setShowNetworkSheet(true)}
              onContinue={handleContinue}
            />
          )}

          {activeTab === 'transfer' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
              {tfSuccess ? (
                <TransferSuccess tfAmount={tfAmount} tfSelectedCoin={tfSelectedCoin} tfUser={tfUser}
                  onSendAgain={() => {
                    setTfSuccess(null); setTfUser(null); setTfIdentifier('');
                    setTfAmount(''); setTfSelectedCoin(null); setTfStep('form');
                    setTfEmailOtp(['','','','','','']);
                  }} />
              ) : tfStep === 'form' ? (
                <TransferForm
                  tfSelectedCoin={tfSelectedCoin} onShowCoinSheet={() => setShowCoinSheet(true)}
                  tfIdentifier={tfIdentifier} setTfIdentifier={setTfIdentifier}
                  onLookup={handleLookup} tfUser={tfUser}
                  tfAmount={tfAmount} setTfAmount={setTfAmount}
                  tfLoading={tfLoading} onContinue={handleTfContinue}
                />
              ) : (
                <TransferOtpStep
                  tfEmailOtp={tfEmailOtp} setTfEmailOtp={setTfEmailOtp} tfEmailRefs={tfEmailRefs}
                  onOtpChange={handleOtpChange} tfResendSec={tfResendSec}
                  onResendOtp={async () => {
                    if (tfResendSec > 0) return;
                    await walletAPI.sendWithdrawalOTP();
                    toast.success('OTP resent!');
                    startTimer(setTfResendSec);
                    setTfEmailOtp(['','','','','','']);
                  }}
                  tfSelectedCoin={tfSelectedCoin} tfUser={tfUser} tfAmount={tfAmount}
                  tfLoading={tfLoading} onSubmit={handleTfSubmit}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* ── STEP: OTP Verify (Withdraw) ── */}
      {step === 'otp' && (
        <WithdrawOtpStep
          selectedCoin={selectedCoin} selectedNetwork={selectedNetwork}
          address={address} amount={amount} feeQty={feeQty} receiveAmt={receiveAmt}
          withdrawInfo={withdrawInfo} emailOtp={emailOtp} setEmailOtp={setEmailOtp}
          totpCode={totpCode} setTotpCode={setTotpCode}
          otpEmailRefs={otpEmailRefs} otpTotpRefs={otpTotpRefs}
          resendSec={resendSec}
          onResendOtp={async () => {
            if (resendSec > 0) return;
            await walletAPI.sendWithdrawalOTP();
            toast.success('OTP resent!');
            startTimer(setResendSec);
            setEmailOtp(['','','','','','']);
          }}
          onOtpChange={handleOtpChange} loading={loading} onSubmit={handleSubmit}
        />
      )}

      <NetworkSheet
        open={showNetworkSheet} onClose={() => setShowNetworkSheet(false)}
        networksLoading={networksLoading} coinNetworks={coinNetworks}
        selectedNetwork={selectedNetwork} selectedCoin={selectedCoin}
        onSelectNetwork={(net: any) => handleNetworkSelect(selectedCoin, net)}
      />

      <CoinSheet
        open={showCoinSheet} onClose={() => setShowCoinSheet(false)}
        search={tfCoinSearch} onSearchChange={setTfCoinSearch}
        coins={tfFilteredCoins} selectedCoin={tfSelectedCoin}
        onSelectCoin={(coin: any) => { setTfSelectedCoin(coin); setShowCoinSheet(false); setTfCoinSearch(''); }}
      />
    </div>
  );
}
