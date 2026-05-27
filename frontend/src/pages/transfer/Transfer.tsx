import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI, marketAPI } from '../../services/api';
import { ChevronLeft, ChevronDown, ArrowDownUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Transfer() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState<any[]>([]);
  const [balances, setBalances] = useState<any>({});
  const [selectedCoin, setSelectedCoin] = useState<any>(null);
  const [showCoinPicker, setShowCoinPicker] = useState(false);
  const [fromAccount, setFromAccount] = useState('spot');
  const [toAccount, setToAccount] = useState('futures');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const accounts = ['spot', 'futures', 'funding', 'earn'];

  useEffect(() => {
    marketAPI.getCoins().then((res: any) => {
      setCoins(res.data || []);
      if (res.data?.length > 0) setSelectedCoin(res.data[0]);
    });
    walletAPI.getBalances().then((res: any) => {
      const bal: any = {};
      (res.data?.balances || []).forEach((b: any) => {
        // Store by symbol+account_type key
        bal[b.symbol + "_" + b.account_type] = b;
        // Also store by symbol (default = spot)
        if (b.account_type === "spot") bal[b.symbol] = b;
      });
      setBalances(bal);
    });
  }, []);

  const getAvailable = () => {
    const allBalances = balances[selectedCoin?.symbol + '_' + fromAccount] ||
                        balances[selectedCoin?.symbol] || {};
    return parseFloat(allBalances.available || 0);
  };
  const available = getAvailable();

  const handleSwap = () => {
    const tmp = fromAccount;
    setFromAccount(toAccount);
    setToAccount(tmp);
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error('Enter amount'); return; }
    if (parseFloat(amount) > available) { toast.error('Insufficient balance'); return; }
    if (fromAccount === toAccount) { toast.error('From and To must be different'); return; }
    setLoading(true);
    try {
      await walletAPI.transfer({ coin: selectedCoin.symbol, from_account: fromAccount, to_account: toAccount, amount });
      toast.success('Transfer successful!');
      setAmount('');
      walletAPI.getBalances().then((res: any) => {
        const bal: any = {};
        (res.data?.balances || []).forEach((b: any) => { bal[b.symbol] = b; });
        setBalances(bal);
      });
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const inp: any = { width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>Internal Transfer</span>
      </div>

      <div style={{ padding: 16 }}>
        {/* Coin Select */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>Coin</div>
          <button onClick={() => setShowCoinPicker(!showCoinPicker)} style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10
          }}>
            {selectedCoin?.logo_url && (
              <img src={selectedCoin.logo_url} alt="" style={{ width: 26, height: 26, borderRadius: '50%' }} />
            )}
            <span style={{ flex: 1, textAlign: 'left', fontWeight: 600, color: 'var(--color-text)' }}>
              {selectedCoin?.symbol}
            </span>
            <ChevronDown size={16} color="var(--color-muted)" />
          </button>

          {showCoinPicker && (
            <div style={{ marginTop: 4, borderRadius: 10, border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)', maxHeight: 180, overflowY: 'auto' }}>
              {coins.map(c => (
                <div key={c.symbol} onClick={() => { setSelectedCoin(c); setShowCoinPicker(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                           cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {c.logo_url && <img src={c.logo_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%' }} />}
                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{c.symbol}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--color-muted)', fontSize: 12 }}>
                    {parseFloat(balances[c.symbol]?.available || 0).toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* From → To with swap */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8,
                      alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>From</div>
            <select value={fromAccount} onChange={e => setFromAccount(e.target.value)} style={inp}>
              {accounts.map(a => (
                <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
              ))}
            </select>
          </div>
          <button onClick={handleSwap} style={{
            marginTop: 20, width: 36, height: 36, borderRadius: '50%',
            background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
            cursor: 'pointer', color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ArrowDownUp size={16} />
          </button>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>To</div>
            <select value={toAccount} onChange={e => setToAccount(e.target.value)} style={inp}>
              {accounts.map(a => (
                <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
                        fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>
            <span>Amount</span>
            <span>Available: <strong style={{ color: 'var(--color-text)' }}>
              {available.toFixed(4)} {selectedCoin?.symbol}
            </strong></span>
          </div>
          <div style={{ position: 'relative' }}>
            <input value={amount} onChange={e => setAmount(e.target.value)}
              type="number" placeholder="0.00" style={inp} />
            <button onClick={() => setAmount(available.toFixed(6))} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-primary)', fontSize: 12, fontWeight: 700
            }}>MAX</button>
          </div>
        </div>

        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', padding: 14, borderRadius: 12, border: 'none',
          background: loading ? 'var(--color-border)' : 'var(--color-primary)',
          color: '#000', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
        }}>
          {loading ? 'Transferring...' : 'Confirm Transfer'}
        </button>
      </div>
    </div>
  );
}
