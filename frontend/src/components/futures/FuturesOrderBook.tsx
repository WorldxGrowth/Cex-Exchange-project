interface Props {
  bids: any[];
  asks: any[];
  currentPrice: number;
  isUp: boolean;
  fundingRate?: number;
  countdown?: string;
  onPriceClick: (p: string) => void;
}

export default function FuturesOrderBook({
  bids, asks, currentPrice, isUp,
  fundingRate = -0.005822, countdown = '',
  onPriceClick
}: Props) {
  const allQtys = [
    ...asks.map((a: any) => parseFloat(a.qty)||0),
    ...bids.map((b: any) => parseFloat(b.qty)||0)
  ];
  const maxQty = Math.max(...allQtys, 0.001);

  return (
    <div style={{ fontSize: 12 }}>

      {/* Funding rate row */}
      <div style={{ padding: '5px 8px', fontSize: 10,
                    borderBottom: '1px solid var(--color-border)',
                    background: 'var(--color-surface)' }}>
        <div style={{ color: 'var(--color-muted)' }}>Funding / Countdown</div>
        <div style={{ color: fundingRate < 0 ? 'var(--color-danger)' : 'var(--color-success)',
                      fontWeight: 600, marginTop: 1 }}>
          {fundingRate.toFixed(6)}% / {countdown}
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    padding: '4px 8px', fontSize: 10, color: 'var(--color-muted)' }}>
        <span>Price(USDT)</span><span>Amount</span>
      </div>

      {/* Asks - reversed */}
      {[...asks].slice(0, 8).reverse().map((ask: any, i: number) => {
        const pct = Math.min((parseFloat(ask.qty) / maxQty) * 100, 100);
        return (
          <div key={i} onClick={() => onPriceClick(parseFloat(ask.price||0).toFixed(4))}
            style={{ display: 'flex', justifyContent: 'space-between',
                     padding: '2.5px 8px', cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0,
                          width: `${pct}%`, background: 'rgba(246,70,93,0.12)' }} />
            <span style={{ color: 'var(--color-danger)', position: 'relative', zIndex: 1 }}>
              {parseFloat(ask.price||0).toFixed(4)}
            </span>
            <span style={{ color: 'var(--color-text)', position: 'relative', zIndex: 1 }}>
              {parseFloat(ask.qty||0).toFixed(4)}
            </span>
          </div>
        );
      })}

      {/* Current Price */}
      <div onClick={() => onPriceClick(currentPrice.toFixed(4))}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                 padding: '5px 8px', cursor: 'pointer',
                 background: isUp ? 'rgba(14,203,129,0.06)' : 'rgba(246,70,93,0.06)' }}>
        <span style={{ fontSize: 14, fontWeight: 800,
                       color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {currentPrice > 0 ? currentPrice.toLocaleString(undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '---'}
        </span>
      </div>

      {/* Bids */}
      {bids.slice(0, 8).map((bid: any, i: number) => {
        const pct = Math.min((parseFloat(bid.qty) / maxQty) * 100, 100);
        return (
          <div key={i} onClick={() => onPriceClick(parseFloat(bid.price||0).toFixed(4))}
            style={{ display: 'flex', justifyContent: 'space-between',
                     padding: '2.5px 8px', cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0,
                          width: `${pct}%`, background: 'rgba(14,203,129,0.12)' }} />
            <span style={{ color: 'var(--color-success)', position: 'relative', zIndex: 1 }}>
              {parseFloat(bid.price||0).toFixed(4)}
            </span>
            <span style={{ color: 'var(--color-text)', position: 'relative', zIndex: 1 }}>
              {parseFloat(bid.qty||0).toFixed(4)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
