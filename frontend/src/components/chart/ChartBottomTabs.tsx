interface Props {
  bottomTab: 'book' | 'trades' | 'info';
  baseSym: string;
  sym: string;
  currentPrice: number;
  change24h: number;
  isUp: boolean;
  high24h: number;
  low24h: number;
  volume24h: number;
  orderBook: any;
  tradesList: any[];
  onTabChange: (t: 'book' | 'trades' | 'info') => void;
}

export default function ChartBottomTabs({
  bottomTab, baseSym, sym, currentPrice, change24h, isUp,
  high24h, low24h, volume24h, orderBook, tradesList, onTabChange
}: Props) {
  return (
    <div style={{ height: 240, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)',
                    flexShrink: 0 }}>
        {(['book', 'trades', 'info'] as const).map(tab => (
          <button key={tab} onClick={() => onTabChange(tab)} style={{
            flex: 1, padding: '8px', background: 'none', border: 'none', cursor: 'pointer',
            color: bottomTab === tab ? 'var(--color-text)' : 'var(--color-muted)',
            borderBottom: bottomTab === tab ? '2px solid #f0b90b' : '2px solid transparent',
            fontSize: 13, fontWeight: bottomTab === tab ? 600 : 400
          }}>
            {tab === 'book' ? 'Order Book' : tab === 'trades' ? 'Market Trades' : 'Info'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>

        {/* Order Book */}
        {bottomTab === 'book' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                          padding: '6px 12px', fontSize: 11, color: 'var(--color-muted)',
                          borderBottom: '1px solid var(--color-border)' }}>
              <span>Amount ({baseSym})</span>
              <span style={{ textAlign: 'center' }}>
                {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ textAlign: 'right' }}>Amount ({baseSym})</span>
            </div>
            {Array.from({ length: 10 }, (_, idx) => {
              const bid = orderBook.bids?.[idx];
              const ask = orderBook.asks?.[idx];
              const bPrice = bid ? parseFloat(bid.price) : 0;
              const aPrice = ask ? parseFloat(ask.price) : 0;
              const bQty = bid ? parseFloat(bid.qty).toFixed(4) : '---';
              const aQty = ask ? parseFloat(ask.qty).toFixed(4) : '---';
              if (!bid && !ask) return null;
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                                         padding: '3px 12px', fontSize: 12 }}>
                  <span style={{ color: 'var(--color-muted)' }}>{bQty}</span>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                    {bPrice > 0 && <span style={{ color: 'var(--color-success)' }}>{bPrice.toFixed(4)}</span>}
                    {aPrice > 0 && <span style={{ color: 'var(--color-danger)' }}>{aPrice.toFixed(4)}</span>}
                  </div>
                  <span style={{ color: 'var(--color-muted)', textAlign: 'right' }}>{aQty}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Market Trades */}
        {bottomTab === 'trades' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                          padding: '6px 12px', fontSize: 11, color: 'var(--color-muted)',
                          borderBottom: '1px solid var(--color-border)' }}>
              <span>Price (USDT)</span>
              <span style={{ textAlign: 'center' }}>Amount ({baseSym})</span>
              <span style={{ textAlign: 'right' }}>Time</span>
            </div>
            {tradesList.map((t: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                                     padding: '3px 12px', fontSize: 12 }}>
                <span style={{ color: t.side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {parseFloat(t.price).toFixed(4)}
                </span>
                <span style={{ color: 'var(--color-muted)', textAlign: 'center' }}>
                  {parseFloat(t.quantity).toFixed(4)}
                </span>
                <span style={{ color: 'var(--color-muted)', textAlign: 'right' }}>
                  {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        {bottomTab === 'info' && (
          <div style={{ padding: '12px 16px' }}>
            {[
              { label: 'Symbol',    value: sym },
              { label: 'Last Price', value: '$' + currentPrice.toLocaleString() },
              { label: '24h Change', value: change24h.toFixed(2) + '%',
                color: isUp ? 'var(--color-success)' : 'var(--color-danger)' },
              { label: '24h High',  value: '$' + high24h.toLocaleString() },
              { label: '24h Low',   value: '$' + low24h.toLocaleString() },
              { label: '24h Volume', value: (volume24h / 1000000).toFixed(2) + 'M USDT' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                                         padding: '6px 0',
                                         borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
                <span style={{ color: 'var(--color-muted)' }}>{label}</span>
                <span style={{ color: color || 'var(--color-text)', fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
