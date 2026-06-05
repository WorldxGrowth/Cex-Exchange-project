import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

interface Props {
  openOrders: any[];
  bottomTab: 'orders' | 'assets';
  balances: any;
  baseSym: string;
  onTabChange: (t: 'orders' | 'assets') => void;
  onCancel: (orderId: string) => void;
}

export default function OpenOrders({
  openOrders, bottomTab, balances, baseSym, onTabChange, onCancel
}: Props) {
  const navigate = useNavigate();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                  overflow: 'hidden', borderTop: '1px solid var(--color-border)' }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0,
                    borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
        {(['orders', 'assets'] as const).map(tab => (
          <button key={tab} onClick={() => onTabChange(tab)} style={{
            padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
            color: bottomTab === tab ? 'var(--color-primary)' : 'var(--color-muted)',
            borderBottom: bottomTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
            fontSize: 13, fontWeight: bottomTab === tab ? 600 : 400
          }}>
            {tab === 'orders' ? `Open Orders (${openOrders.length})` : 'Assets'}
          </button>
        ))}
        <button onClick={() => navigate('/orders')} style={{
          marginLeft: 'auto', padding: '8px 12px', background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--color-muted)',
          display: 'flex', alignItems: 'center', gap: 4, fontSize: 12
        }}>
          <BookOpen size={14} /> History
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>

        {bottomTab === 'orders' && (
          openOrders.length === 0
            ? <div style={{ padding: '20px', textAlign: 'center',
                            color: 'var(--color-muted)', fontSize: 13 }}>
                No open orders
              </div>
            : openOrders.map((o: any) => (
              <div key={o.order_id} style={{ padding: '12px 16px',
                                             borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                              alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      background: o.side === 'buy' ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)',
                      color: o.side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)',
                      textTransform: 'uppercase'
                    }}>{o.side}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                      {o.pair_symbol}
                    </span>
                  </div>
                  <button onClick={() => onCancel(o.order_id)} style={{
                    padding: '4px 12px', borderRadius: 20,
                    border: '1px solid var(--color-danger)',
                    background: 'none', color: 'var(--color-danger)',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600
                  }}>Cancel</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--color-muted)' }}>
                    Price: <span style={{ color: 'var(--color-text)' }}>
                      {parseFloat(o.price||0).toFixed(4)}
                    </span>
                  </span>
                  <span style={{ color: 'var(--color-muted)' }}>
                    Qty: <span style={{ color: 'var(--color-text)' }}>
                      {parseFloat(o.remaining_qty||0).toFixed(5)}
                    </span>
                  </span>
                </div>
              </div>
            ))
        )}

        {bottomTab === 'assets' && (
          <div style={{ padding: '12px 16px' }}>
            {[
              { label: 'USDT', val: parseFloat(balances['USDT']?.available||0).toFixed(4) },
              { label: baseSym, val: parseFloat(balances[baseSym]?.available||0).toFixed(6) },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                                        padding: '8px 0',
                                        borderBottom: '1px solid var(--color-border)', fontSize: 14 }}>
                <span style={{ color: 'var(--color-muted)' }}>{label}</span>
                <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
