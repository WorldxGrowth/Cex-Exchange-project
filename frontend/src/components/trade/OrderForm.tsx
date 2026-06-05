import { ChevronDown } from 'lucide-react';

interface Props {
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market';
  price: string;
  quantity: string;
  totalInput: string;
  pct: number;
  loading: boolean;
  availBal: number;
  baseSym: string;
  currentPrice: number;
  showDropdown: boolean;
  onSideChange: (s: 'buy' | 'sell') => void;
  onOrderTypeChange: (t: 'limit' | 'market') => void;
  onPriceChange: (v: string) => void;
  onQuantityChange: (v: string) => void;
  onTotalChange: (v: string) => void;
  onPctChange: (p: number) => void;
  onPlace: () => void;
  onDropdownToggle: () => void;
}

export default function OrderForm({
  side, orderType, price, quantity, totalInput, pct, loading,
  availBal, baseSym, currentPrice, showDropdown,
  onSideChange, onOrderTypeChange, onPriceChange, onQuantityChange,
  onTotalChange, onPctChange, onPlace, onDropdownToggle
}: Props) {

  const inp: any = {
    width: '100%', padding: '9px 10px', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
    color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ flex: 1, maxHeight: '56vh', overflow: 'auto', padding: '8px 10px' }}>

      {/* Buy / Sell */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                    borderRadius: 8, overflow: 'hidden',
                    border: '1px solid var(--color-border)', marginBottom: 8 }}>
        <button onClick={() => onSideChange('buy')} style={{
          padding: '9px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          background: side === 'buy' ? 'var(--color-success)' : 'transparent',
          color: side === 'buy' ? '#fff' : 'var(--color-muted)'
        }}>Buy</button>
        <button onClick={() => onSideChange('sell')} style={{
          padding: '9px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          background: side === 'sell' ? 'var(--color-danger)' : 'transparent',
          color: side === 'sell' ? '#fff' : 'var(--color-muted)'
        }}>Sell</button>
      </div>

      {/* Order type dropdown */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <button onClick={onDropdownToggle} style={{
          width: '100%', padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
          border: '1px solid var(--color-border)', background: 'var(--color-bg)',
          color: 'var(--color-text)', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span>{orderType.charAt(0).toUpperCase() + orderType.slice(1)}</span>
          <ChevronDown size={13} color="var(--color-muted)"
            style={{ transform: showDropdown ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </button>
        {showDropdown && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                        borderRadius: 8, marginTop: 2, overflow: 'hidden',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
            {(['limit', 'market'] as const).map(t => (
              <button key={t} onClick={() => onOrderTypeChange(t)} style={{
                width: '100%', padding: '10px 12px', border: 'none', cursor: 'pointer',
                background: orderType === t ? 'var(--color-surface2)' : 'transparent',
                color: orderType === t ? 'var(--color-primary)' : 'var(--color-text)',
                fontSize: 13, textAlign: 'left', fontWeight: orderType === t ? 600 : 400
              }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Available balance */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
        <span style={{ color: 'var(--color-muted)' }}>Avail.</span>
        <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>
          {availBal.toFixed(4)} {side === 'buy' ? 'USDT' : baseSym}
        </span>
      </div>

      {/* Price (limit only) */}
      {orderType === 'limit' && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 3 }}>Price (USDT)</div>
          <div style={{ position: 'relative' }}>
            <input value={price} onChange={e => onPriceChange(e.target.value)}
              type="number" style={inp} />
            <button onClick={() => onPriceChange(currentPrice.toFixed(4))}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                       background: 'none', border: 'none', cursor: 'pointer',
                       color: 'var(--color-primary)', fontSize: 10, fontWeight: 700 }}>
              LAST
            </button>
          </div>
        </div>
      )}

      {/* Quantity */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 3 }}>
          Qty ({baseSym})
        </div>
        <input value={quantity} onChange={e => onQuantityChange(e.target.value)}
          type="number" placeholder="0.00000" style={inp} />
      </div>

      {/* Slider */}
      <div style={{ marginBottom: 6 }}>
        <input type="range" min="0" max="100" step="1" value={pct}
          onChange={e => onPctChange(parseInt(e.target.value))}
          style={{ width: '100%',
                   accentColor: side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 1 }}>
          {[0, 25, 50, 75, 100].map(p => (
            <span key={p} onClick={() => onPctChange(p)} style={{
              fontSize: 10, cursor: 'pointer',
              color: pct >= p && pct > 0 ? 'var(--color-primary)' : 'var(--color-muted)',
              fontWeight: pct === p ? 700 : 400
            }}>{p}%</span>
          ))}
        </div>
      </div>

      {/* Total */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 3 }}>Total (USDT)</div>
        <input
          value={totalInput || (quantity && price
            ? (parseFloat(quantity) * parseFloat(price)).toFixed(2) : '')}
          onChange={e => onTotalChange(e.target.value)}
          type="number" placeholder="0.00" style={inp} />
      </div>

      {/* Place order button */}
      <button onClick={onPlace} disabled={loading} style={{
        width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)',
        color: '#fff', fontSize: 14, fontWeight: 700, opacity: loading ? 0.7 : 1
      }}>
        {loading ? 'Placing...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${baseSym}`}
      </button>
    </div>
  );
}
