import { useState } from 'react';
import { X } from 'lucide-react';
import { orderAPI, walletAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface Props {
  sym: string;
  baseSym: string;
  currentPrice: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuickOrderSheet({ sym, baseSym, currentPrice, onClose, onSuccess }: Props) {
  const [side, setSide]         = useState<'buy'|'sell'>('buy');
  const [orderType, setOrderType] = useState<'market'|'limit'>('market');
  const [price, setPrice]       = useState(currentPrice.toFixed(4));
  const [total, setTotal]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [availBal, setAvailBal] = useState(0);

  useState(() => {
    walletAPI.getBalances().then((res: any) => {
      const balances = res.data?.balances || [];
      const coin = side === 'buy' ? 'USDT' : baseSym;
      const b = balances.find((b: any) => b.symbol === coin && b.account_type === 'spot');
      setAvailBal(parseFloat(b?.available || 0));
    });
  });

  const handlePlace = async () => {
    if (!total || parseFloat(total) <= 0) { toast.error('Enter amount'); return; }
    setLoading(true);
    try {
      const quantity = orderType === 'market'
        ? (parseFloat(total) / currentPrice).toFixed(6)
        : (parseFloat(total) / parseFloat(price)).toFixed(6);

      const res: any = await orderAPI.place({
        symbol: sym, side, order_type: orderType,
        price: orderType === 'limit' ? price : undefined,
        quantity
      });
      const order = res.data;
      if (order?.status === 'filled') {
        toast.success(`✅ ${side.toUpperCase()} filled @ ${parseFloat(order.avg_fill_price||order.price||0).toFixed(4)}`);
      } else {
        toast.success(`${side.toUpperCase()} order placed!`);
      }
      setTotal('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Order failed');
    } finally { setLoading(false); }
  };

  const inp: any = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
    color: 'var(--color-text)', fontSize: 14, outline: 'none'
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99
      }} />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--color-surface)', borderRadius: '16px 16px 0 0',
        padding: '16px', maxHeight: '70vh', overflow: 'auto'
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2,
                      background: 'var(--color-border)', margin: '0 auto 16px' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 16,
                         color: 'var(--color-text)' }}>{baseSym}/USDT</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--color-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Buy/Sell toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                      borderRadius: 8, overflow: 'hidden',
                      border: '1px solid var(--color-border)', marginBottom: 12 }}>
          <button onClick={() => setSide('buy')} style={{
            padding: '10px', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 700,
            background: side === 'buy' ? 'var(--color-success)' : 'transparent',
            color: side === 'buy' ? '#fff' : 'var(--color-muted)'
          }}>Buy</button>
          <button onClick={() => setSide('sell')} style={{
            padding: '10px', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 700,
            background: side === 'sell' ? 'var(--color-danger)' : 'transparent',
            color: side === 'sell' ? '#fff' : 'var(--color-muted)'
          }}>Sell</button>
        </div>

        {/* Order type */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['market', 'limit'] as const).map(t => (
            <button key={t} onClick={() => setOrderType(t)} style={{
              padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
              border: '1px solid var(--color-border)',
              background: orderType === t ? 'var(--color-surface2)' : 'transparent',
              color: orderType === t ? 'var(--color-primary)' : 'var(--color-muted)',
              fontWeight: orderType === t ? 600 : 400
            }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>

        {/* Available */}
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      fontSize: 12, marginBottom: 10 }}>
          <span style={{ color: 'var(--color-muted)' }}>Available</span>
          <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>
            {availBal.toFixed(4)} {side === 'buy' ? 'USDT' : baseSym}
          </span>
        </div>

        {/* Price (limit) */}
        {orderType === 'limit' && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>Price (USDT)</div>
            <input value={price} onChange={e => setPrice(e.target.value)}
              type="number" style={inp} />
          </div>
        )}

        {/* Total */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>
            Total (USDT)
          </div>
          <input value={total} onChange={e => setTotal(e.target.value)}
            type="number" placeholder="0.00" style={inp} />
        </div>

        {/* Quick amounts */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[10, 25, 50, 100].map(amt => (
            <button key={amt} onClick={() => setTotal(String(amt))} style={{
              flex: 1, padding: '6px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-muted)', fontSize: 12
            }}>${amt}</button>
          ))}
        </div>

        {/* Place button */}
        <button onClick={handlePlace} disabled={loading} style={{
          width: '100%', padding: '14px', borderRadius: 12, border: 'none',
          cursor: 'pointer', fontSize: 15, fontWeight: 700,
          background: side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)',
          color: '#fff', opacity: loading ? 0.7 : 1
        }}>
          {loading ? 'Placing...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${baseSym}`}
        </button>
      </div>
    </>
  );
}
