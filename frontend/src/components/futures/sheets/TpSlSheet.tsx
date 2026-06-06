import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  currentPrice: number;
  side: 'long' | 'short';
  onConfirm: (tp: string, sl: string) => void;
  onClose: () => void;
}

export default function TpSlSheet({ currentPrice, side, onConfirm, onClose }: Props) {
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');

  const inp: any = {
    width: '100%', padding: '12px', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 14, outline: 'none'
  };

  const tpPnl = tp && currentPrice > 0
    ? (((parseFloat(tp) - currentPrice) / currentPrice) * 100 * (side === 'short' ? -1 : 1)).toFixed(2)
    : null;
  const slPnl = sl && currentPrice > 0
    ? (((parseFloat(sl) - currentPrice) / currentPrice) * 100 * (side === 'short' ? -1 : 1)).toFixed(2)
    : null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)', zIndex: 99 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
                    background: 'var(--color-surface)', borderRadius: '16px 16px 0 0',
                    padding: '20px 16px 32px' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2,
                      background: 'var(--color-border)', margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
            Take Profit / Stop Loss
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--color-muted)' }}><X size={20} /></button>
        </div>

        {/* Take Profit */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
                        fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Take Profit</span>
            {tpPnl && (
              <span style={{ color: parseFloat(tpPnl) >= 0
                ? 'var(--color-success)' : 'var(--color-danger)', fontSize: 12 }}>
                ROI: {tpPnl}%
              </span>
            )}
          </div>
          <input value={tp} onChange={e => setTp(e.target.value)}
            type="number" placeholder="TP price (USDT)" style={inp} />
        </div>

        {/* Stop Loss */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
                        fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Stop Loss</span>
            {slPnl && (
              <span style={{ color: parseFloat(slPnl) >= 0
                ? 'var(--color-success)' : 'var(--color-danger)', fontSize: 12 }}>
                ROI: {slPnl}%
              </span>
            )}
          </div>
          <input value={sl} onChange={e => setSl(e.target.value)}
            type="number" placeholder="SL price (USDT)" style={inp} />
        </div>

        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 16 }}>
          Current price: <span style={{ color: 'var(--color-text)' }}>
            {currentPrice.toLocaleString()} USDT
          </span>
        </div>

        <button onClick={() => { onConfirm(tp, sl); onClose(); }} style={{
          width: '100%', padding: '14px', borderRadius: 12, border: 'none',
          background: 'var(--color-primary)', color: '#000',
          fontWeight: 700, cursor: 'pointer', fontSize: 15
        }}>Confirm</button>
      </div>
    </>
  );
}
