import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI, marketAPI } from '../../services/api';
import { ChevronLeft, ChevronDown, Search, AlertTriangle, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Withdraw() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'coin'|'form'|'confirm'|'success'>('coin');
  const [coins, setCoins] = useState<any[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<any>(null);
  const [withdrawInfo, setWithdrawInfo] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    marketAPI.getCoins().then((res: any) => {
      setCoins((res.data || []).filter((c: any) => c.is_withdraw));
    });
  }, []);

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

  const fee = withdrawInfo
    ? parseFloat(withdrawInfo.fee_fixed || 0) +
      (parseFloat(amount || 0) * parseFloat(withdrawInfo.fee_percent || 0) / 100)
    : 0;

  const receiveAmt = Math.max(0, parseFloat(amount || 0) - fee);

  const handleSubmit = () => {
    if (!address) { toast.error('Enter withdrawal address'); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error('Enter amount'); return; }
    if (parseFloat(amount) < withdrawInfo.min_amount)
      { toast.error(`Min: ${withdrawInfo.min_amount} ${selectedCoin.symbol}`); return; }
    if (parseFloat(amount) > withdrawInfo.available)
      { toast.error('Insufficient balance'); return; }
    setStep('confirm');
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res: any = await walletAPI.requestWithdrawal({
        coin: selectedCoin.symbol,
        network: withdrawInfo.network,
        amount,
        address
      });
      setResult(res.data);
      setStep('success');
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally { setLoading(false); }
  };

  const inp: any = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box'
  };

  const filtered = coins.filter(c =>
    !search || c.symbol.toLowerCase().includes(search.toLowerCase()) ||
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => step === 'coin' ? navigate(-1) : setStep('coin')}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
                   color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
          {step === 'coin' ? 'Withdraw' : step === 'confirm' ? 'Confirm Withdrawal' :
           step === 'success' ? 'Submitted' : `Withdraw ${selectedCoin?.symbol}`}
        </span>
      </div>

      {/* STEP 1: Coin Select */}
      {step === 'coin' && (
        <div>
          <div style={{ padding: '12px 16px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search coin..."
                style={{ ...inp, paddingLeft: 32 }} />
            </div>
          </div>
          <div style={{ padding: '0 16px 6px', fontSize: 12,
                        color: 'var(--color-muted)', fontWeight: 600 }}>
            Select Coin
          </div>
          {filtered.map(coin => (
            <div key={coin.symbol} onClick={() => handleCoinSelect(coin)}
              style={{ display: 'flex', alignItems: 'center', gap: 12,
                       padding: '14px 16px', cursor: 'pointer',
                       borderBottom: '1px solid var(--color-border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {coin.logo_url
                ? <img src={coin.logo_url} alt=""
                    style={{ width: 36, height: 36, borderRadius: '50%' }} />
                : <div style={{ width: 36, height: 36, borderRadius: '50%',
                                background: 'var(--color-surface2)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, color: 'var(--color-primary)' }}>
                    {coin.symbol?.charAt(0)}
                  </div>
              }
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{coin.symbol}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{coin.name}</div>
              </div>
              <ChevronDown size={16} color="var(--color-muted)"
                style={{ transform: 'rotate(-90deg)' }} />
            </div>
          ))}
        </div>
      )}

      {/* STEP 2: Form */}
      {step === 'form' && withdrawInfo && (
        <div style={{ padding: '16px' }}>
          {/* Warning */}
          <div style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 20,
                        background: 'rgba(240,185,11,0.08)',
                        border: '1px solid rgba(240,185,11,0.2)',
                        display: 'flex', gap: 8 }}>
            <AlertTriangle size={16} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
              Only withdraw to <strong>{withdrawInfo.network_name}</strong> addresses.
              Wrong network = permanent loss!
            </div>
          </div>

          {/* Network Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16,
                        padding: '10px 14px', borderRadius: 10,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Network</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
              {withdrawInfo.network_name}
            </span>
          </div>

          {/* Address */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>
              Withdrawal Address
            </div>
            <input value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Enter wallet address" style={inp} />
          </div>

          {/* Amount */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>
              <span>Amount</span>
              <span>Available: <strong style={{ color: 'var(--color-text)' }}>
                {parseFloat(withdrawInfo.available || 0).toFixed(6)} {selectedCoin?.symbol}
              </strong></span>
            </div>
            <div style={{ position: 'relative' }}>
              <input value={amount} onChange={e => setAmount(e.target.value)}
                type="number" placeholder="0.00" style={{ ...inp, paddingRight: 60 }} />
              <button onClick={() => {
                const max = Math.min(
                  withdrawInfo.available,
                  withdrawInfo.max_amount
                );
                setAmount((max - fee).toFixed(6));
              }} style={{
                position: 'absolute', right: 10, top: '50%',
                transform: 'translateY(-50%)', background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--color-primary)',
                fontSize: 12, fontWeight: 700
              }}>MAX</button>
            </div>
          </div>

          {/* Min/Max info */}
          <div style={{ display: 'flex', justifyContent: 'space-between',
                        fontSize: 11, color: 'var(--color-muted)', marginBottom: 20 }}>
            <span>Min: {withdrawInfo.min_amount} {selectedCoin?.symbol}</span>
            <span>Max: {withdrawInfo.max_amount} {selectedCoin?.symbol}</span>
          </div>

          {/* Fee breakdown */}
          <div style={{ padding: '14px', borderRadius: 10, marginBottom: 20,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)' }}>
            {[
              { label: 'Amount', value: `${parseFloat(amount || 0).toFixed(6)} ${selectedCoin?.symbol}` },
              { label: 'Network Fee', value: `${fee.toFixed(6)} ${selectedCoin?.symbol}` },
              { label: 'You Receive', value: `${receiveAmt.toFixed(6)} ${selectedCoin?.symbol}`,
                highlight: true },
            ].map(({ label, value, highlight }: any) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                                        padding: '4px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--color-muted)' }}>{label}</span>
                <span style={{ color: highlight ? 'var(--color-success)' : 'var(--color-text)',
                               fontWeight: highlight ? 700 : 500 }}>{value}</span>
              </div>
            ))}
          </div>

          <button onClick={handleSubmit} disabled={loading} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: loading ? 'var(--color-border)' : 'var(--color-primary)',
            color: '#000', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
          }}>
            {loading ? 'Loading...' : 'Continue'}
          </button>
        </div>
      )}

      {/* STEP 3: Confirm */}
      {step === 'confirm' && (
        <div style={{ padding: '16px' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12,
                        border: '1px solid var(--color-border)',
                        overflow: 'hidden', marginBottom: 20 }}>
            {[
              { label: 'Coin', value: selectedCoin?.symbol },
              { label: 'Network', value: withdrawInfo?.network_name },
              { label: 'To Address', value: address.slice(0,12) + '...' + address.slice(-8) },
              { label: 'Amount', value: `${parseFloat(amount).toFixed(6)} ${selectedCoin?.symbol}` },
              { label: 'Fee', value: `${fee.toFixed(6)} ${selectedCoin?.symbol}` },
              { label: 'You Receive', value: `${receiveAmt.toFixed(6)} ${selectedCoin?.symbol}` },
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '14px 16px', fontSize: 13,
                borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none'
              }}>
                <span style={{ color: 'var(--color-muted)' }}>{label}</span>
                <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Warning */}
          <div style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 20,
                        background: 'rgba(246,70,93,0.08)',
                        border: '1px solid rgba(246,70,93,0.2)',
                        fontSize: 12, color: 'var(--color-muted)' }}>
            ⚠️ Please verify the address carefully. Crypto transactions are irreversible!
          </div>

          <button onClick={handleConfirm} disabled={loading} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: loading ? 'var(--color-border)' : 'var(--color-danger)',
            color: '#fff', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15,
            marginBottom: 10
          }}>
            {loading ? 'Processing...' : 'Confirm Withdrawal'}
          </button>

          <button onClick={() => setStep('form')} style={{
            width: '100%', padding: '12px', borderRadius: 12,
            border: '1px solid var(--color-border)', background: 'none',
            color: 'var(--color-text)', cursor: 'pointer', fontSize: 14
          }}>Back</button>
        </div>
      )}

      {/* STEP 4: Success */}
      {step === 'success' && result && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ width: 70, height: 70, borderRadius: '50%',
                        background: 'rgba(14,203,129,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px' }}>
            <Check size={36} color="var(--color-success)" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)',
                        marginBottom: 8 }}>
            Withdrawal Submitted!
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 24 }}>
            {result.message}
          </div>

          <div style={{ background: 'var(--color-surface)', borderRadius: 12,
                        border: '1px solid var(--color-border)',
                        padding: '16px', marginBottom: 24, textAlign: 'left' }}>
            {[
              { label: 'TX ID', value: result.tx_id },
              { label: 'Amount', value: `${result.amount} ${selectedCoin?.symbol}` },
              { label: 'You Receive', value: `${result.receive_amount} ${selectedCoin?.symbol}` },
              { label: 'Status', value: result.status === 'processing'
                ? '⚡ Auto Processing' : '⏳ Pending Approval' },
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
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: 'var(--color-primary)', color: '#000',
            fontWeight: 700, cursor: 'pointer', fontSize: 15
          }}>Back to Assets</button>
        </div>
      )}
    </div>
  );
}
