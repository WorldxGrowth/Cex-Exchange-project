import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI, marketAPI } from '../../services/api';
import { ChevronLeft, ChevronDown, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Withdraw() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState<any[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<any>(null);
  const [balances, setBalances] = useState<any>({});
  const [showCoinPicker, setShowCoinPicker] = useState(false);
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    marketAPI.getCoins().then((res: any) => {
      const w = (res.data || []).filter((c: any) => c.is_withdraw);
      setCoins(w);
      if (w.length > 0) setSelectedCoin(w[0]);
    });
    walletAPI.getBalances().then((res: any) => {
      const bal: any = {};
      (res.data?.balances || []).forEach((b: any) => { bal[b.symbol] = b; });
      setBalances(bal);
    });
  }, []);

  const available = parseFloat(balances[selectedCoin?.symbol]?.available || 0);
  const fee = parseFloat(selectedCoin?.withdraw_fee || 0);
  const willReceive = parseFloat(amount || 0) - fee;

  const handleSubmit = async () => {
    if (!address) { toast.error('Enter withdrawal address'); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error('Enter amount'); return; }
    if (parseFloat(amount) > available) { toast.error('Insufficient balance'); return; }
    if (willReceive <= 0) { toast.error('Amount too small after fee'); return; }

    setLoading(true);
    try {
      await walletAPI.withdraw({
        coin: selectedCoin.symbol,
        to_address: address,
        amount
      });
      toast.success('Withdrawal submitted! Processing within 24 hours.');
      navigate('/assets');
    } catch (err: any) {
      toast.error(err?.message || 'Withdrawal failed');
    } finally { setLoading(false); }
  };

  const inp: any = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>Withdraw</span>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Coin Selector */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>Coin</div>
          <button onClick={() => setShowCoinPicker(!showCoinPicker)} style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10
          }}>
            {selectedCoin?.logo_url && (
              <img src={selectedCoin.logo_url} alt=""
                style={{ width: 28, height: 28, borderRadius: '50%' }} />
            )}
            <span style={{ flex: 1, textAlign: 'left', fontWeight: 600,
                           color: 'var(--color-text)', fontSize: 15 }}>
              {selectedCoin?.symbol || 'Select coin'}
            </span>
            <ChevronDown size={16} color="var(--color-muted)" />
          </button>

          {showCoinPicker && (
            <div style={{ marginTop: 4, borderRadius: 10, border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)', overflow: 'hidden', maxHeight: 200,
                          overflowY: 'auto' }}>
              {coins.map(c => (
                <div key={c.symbol} onClick={() => { setSelectedCoin(c); setShowCoinPicker(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10,
                           padding: '12px 14px', cursor: 'pointer',
                           borderBottom: '1px solid var(--color-border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {c.logo_url && <img src={c.logo_url} alt=""
                    style={{ width: 24, height: 24, borderRadius: '50%' }} />}
                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{c.symbol}</span>
                  <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>{c.name}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--color-success)', fontSize: 12 }}>
                    {parseFloat(balances[c.symbol]?.available || 0).toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Network info */}
        {selectedCoin && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10,
                        background: 'var(--color-surface2)',
                        border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Network</div>
            <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: 2 }}>
              {selectedCoin.network_name || selectedCoin.network}
            </div>
          </div>
        )}

        {/* Address Input */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>
            Withdrawal Address
          </div>
          <textarea
            value={address} onChange={e => setAddress(e.target.value)}
            placeholder="Enter wallet address..."
            rows={2}
            style={{ ...inp, resize: 'none', fontFamily: 'monospace', fontSize: 13 }}
          />
        </div>

        {/* Amount Input */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
                        fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>
            <span>Amount</span>
            <span>Available: <strong style={{ color: 'var(--color-text)' }}>
              {available.toFixed(6)} {selectedCoin?.symbol}
            </strong></span>
          </div>
          <div style={{ position: 'relative' }}>
            <input value={amount} onChange={e => setAmount(e.target.value)}
              type="number" placeholder="0.00" style={inp} />
            <button onClick={() => setAmount(available.toFixed(6))}
              style={{ position: 'absolute', right: 10, top: '50%',
                       transform: 'translateY(-50%)', background: 'none', border: 'none',
                       cursor: 'pointer', color: 'var(--color-primary)',
                       fontSize: 12, fontWeight: 700 }}>MAX</button>
          </div>
        </div>

        {/* Fee + Receive info */}
        {amount && parseFloat(amount) > 0 && (
          <div style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 16,
                        background: 'var(--color-surface2)',
                        border: '1px solid var(--color-border)' }}>
            {[
              { label: 'Withdrawal Fee', value: `${fee} ${selectedCoin?.symbol}` },
              { label: 'You will receive', value: `${willReceive > 0 ? willReceive.toFixed(6) : '0'} ${selectedCoin?.symbol}`,
                highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                                        padding: '4px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--color-muted)' }}>{label}</span>
                <span style={{ color: highlight ? 'var(--color-success)' : 'var(--color-text)',
                               fontWeight: highlight ? 700 : 400 }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Warning */}
        <div style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 20,
                      background: 'rgba(246,70,93,0.06)',
                      border: '1px solid rgba(246,70,93,0.15)',
                      display: 'flex', gap: 10 }}>
          <AlertTriangle size={16} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.6 }}>
            Ensure address is correct and on <strong style={{ color: 'var(--color-text)' }}>
            {selectedCoin?.network_name || selectedCoin?.network}</strong> network.
            Wrong address = permanent loss.
          </div>
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', padding: '14px', borderRadius: 12,
          background: loading ? 'var(--color-border)' : 'var(--color-primary)',
          border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          color: '#000', fontSize: 15, fontWeight: 700
        }}>
          {loading ? 'Submitting...' : 'Submit Withdrawal'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-muted)', marginTop: 12 }}>
          Processing time: Up to 24 hours
        </div>
      </div>
    </div>
  );
}
