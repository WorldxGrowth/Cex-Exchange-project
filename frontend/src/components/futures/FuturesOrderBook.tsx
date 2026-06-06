interface Props {
  bids: any[];
  asks: any[];
  currentPrice: number;
  isUp: boolean;
  onPriceClick: (p: string) => void;
}

export default function FuturesOrderBook({ bids, asks, currentPrice, isUp, onPriceClick }: Props) {
  const allQtys = [...asks.map((a: any) => parseFloat(a.qty)||0),
                   ...bids.map((b: any) => parseFloat(b.qty)||0)];
  const maxQty = Math.max(...allQtys, 0.001);
  const fmt = (n: number) => n >= 1000000 ? (n/1000000).toFixed(2)+'M'
    : n >= 1000 ? (n/1000).toFixed(3)+'K' : n.toFixed(4);

  return (
    <div style={{ fontSize: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    padding: '6px 8px', fontSize: 11, color: 'var(--color-muted)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <span>Price (USDT)</span>
        <span>Amount (USDT)</span>
      </div>

      {/* Asks (sell) - reversed */}
      {[...asks].slice(0, 8).reverse().map((ask: any, i: number) => {
        const pct = Math.min((parseFloat(ask.qty)/maxQty)*100, 100);
        return (
          <div key={i} onClick={() => onPriceClick(parseFloat(ask.price||0).toFixed(2))}
            style={{ display: 'flex', justifyContent: 'space-between',
                     padding: '3px 8px', cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0,
                          width: `${pct}%`, background: 'rgba(246,70,93,0.12)' }} />
            <span style={{ color: 'var(--color-danger)', position: 'relative',
                           zIndex: 1, fontWeight: 500 }}>
              {parseFloat(ask.price||0).toFixed(2)}
            </span>
            <span style={{ color: 'var(--color-text)', position: 'relative', zIndex: 1 }}>
              {fmt(parseFloat(ask.qty||0))}
            </span>
          </div>
        );
      })}

      {/* Current Price */}
      <div onClick={() => onPriceClick(currentPrice.toFixed(2))}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                 padding: '6px 8px', cursor: 'pointer',
                 background: isUp ? 'rgba(14,203,129,0.06)' : 'rgba(246,70,93,0.06)',
                 borderTop: '1px solid var(--color-border)',
                 borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ fontSize: 15, fontWeight: 700,
                       color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {currentPrice > 0
            ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })
            : '---'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>
          ${currentPrice > 0 ? currentPrice.toLocaleString() : '---'}
        </span>
      </div>

      {/* Bids (buy) */}
      {bids.slice(0, 8).map((bid: any, i: number) => {
        const pct = Math.min((parseFloat(bid.qty)/maxQty)*100, 100);
        return (
          <div key={i} onClick={() => onPriceClick(parseFloat(bid.price||0).toFixed(2))}
            style={{ display: 'flex', justifyContent: 'space-between',
                     padding: '3px 8px', cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0,
                          width: `${pct}%`, background: 'rgba(14,203,129,0.12)' }} />
            <span style={{ color: 'var(--color-success)', position: 'relative',
                           zIndex: 1, fontWeight: 500 }}>
              {parseFloat(bid.price||0).toFixed(2)}
            </span>
            <span style={{ color: 'var(--color-text)', position: 'relative', zIndex: 1 }}>
              {fmt(parseFloat(bid.qty||0))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
