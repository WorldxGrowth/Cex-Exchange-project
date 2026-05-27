import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI, marketAPI } from '../../services/api';
import { ChevronLeft, ChevronDown, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Transfer() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState<any[]>([]);
  const [balances, setBalances] = useState<any>({});
  const [selectedCoin, setSelectedCoin] = useState<any>(null);
  const [from, setFrom] = useState('spot');
  const [to, setTo] = useState('futures');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const accounts = ['spot', 'futures', 'funding', 'earn'];

  useEffect(() => {
    marketAPI.getCoins().then((res: any) => {
      const c = res.data || [];
      setCoins(c);
      if (c.length > 0) setSelectedCoin(c[0]);
    });
    walletAPI.getBalances().then((res: any) => {
      const bal: any = {};
      (res.data?.balances || []).forEach((b: any) => { bal[b.symbol] = b; });
      setBalances(bal);
    });
  }, []);

  const available = parseFloat(balances[selectedCoin?.symbol]?.available || 0);

  const handleSwap = () => { const t = from; setFrom(to); setTo(t); };

  const handleTransfer = async () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error('Enter amount'); return; }
    if (parseFloat(amount) > available) { toast.error('Insufficient balance'); return; }
    if (from === to) { toast.error('From and to cannot be same'); return; }
    setLoading(true);
    try {
      await walletAPI.transfer({ coin: selectedCoin.symbol, from_account: from, to_account: to, amount });
      toast.success(`Transferred ${amount} ${selectedCoin.symbol}`);
      navigate(-1);
    } catch (err: any) {
      toast.error(err?.message || 'Transfer failed');
    } finally { setLoading(false); }
  };

  const inp: any = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>Transfer</span>
      </div>

      <div style={{ padding: '16px' }}>
        {/* From/To with swap */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          {['From', 'To'].map((label, i) => (
            <div key={label} style={{ marginBottom: i === 0 ? 8 : 0 }}>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>{label}</div>
              <select value={i === 0 ? from : to}
                onChange={e => i === 0 ? setFrom(e.target.value) : setTo(e.target.value)}
                style={inp}>
                {accounts.map(acc => (
                  <option key={acc} value={acc}>
                    {acc.charAt(0).toUpperCase() + acc.slice(1)} Account
                  </option>
                ))}
              </select>
            </div>
          ))}
          {/* Swap button */}
          <button onClick={handleSwap} style={{
            position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--color-primary)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ArrowDown size={16} color="#000" />
          </button>
        </div>

        {/* Coin */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>Coin</div>
          <select value={selectedCoin?.id || ''} style={inp}
            onChange={e => setSelectedCoin(coins.find(c => c.id === e.target.value))}>
            {coins.map(c => (
              <option key={c.id} value={c.id}>{c.symbol} - {c.name}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12,
                        color: 'var(--color-muted)', marginBottom: 6 }}>
            <span>Amount</span>
            <span>Available: <strong style={{ color: 'var(--color-text)' }}>
              {available.toFixed(6)} {selectedCoin?.symbol}
            </strong></span>
          </div>
          <div style={{ position: 'relative' }}>
            <input value={amount} onChange={e => setAmount(e.target.value)}
              type="number" placeholder="0.00" style={inp} />
            <button onClick={() => setAmount(available.toFixed(6))}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                       background: 'none', border: 'none', cursor: 'pointer',
                       color: 'var(--color-primary)', fontSize: 12, fontWeight: 700 }}>MAX</button>
          </div>
        </div>

        <button onClick={handleTransfer} disabled={loading} style={{
          width: '100%', padding: '14px', borderRadius: 12, border: 'none',
          background: 'var(--color-primary)', color: '#000', fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
        }}>
          {loading ? 'Transferring...' : 'Confirm Transfer'}
        </button>
      </div>
    </div>
  );
}
