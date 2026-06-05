interface Props {
  bids: any[];
  asks: any[];
  currentPrice: number;
  isUp: boolean;
  showTrades: boolean;
  trades: any[];
  onPriceClick: (p: string) => void;
}

const OrderBook = ({ bids, asks, currentPrice, isUp, onPriceClick }: Props) => {
  const allQtys = [
    ...asks.map((a: any) => parseFloat(a.qty)||0),
    ...bids.map((b: any) => parseFloat(b.qty)||0)
  ];
  const maxQty = Math.max(...allQtys, 0.001);

  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    padding: '4px 8px', fontSize: 10, color: 'var(--color-muted)' }}>
        <span>Price(USDT)</span><span>Amount</span>
      </div>

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
};

export const RecentTrades = ({ trades }: { trades: any[] }) => (
  <div style={{ fontSize: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between',
                  padding: '4px 8px', fontSize: 10, color: 'var(--color-muted)' }}>
      <span>Price</span><span>Amount</span><span>Time</span>
    </div>
    {trades.length === 0
      ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-muted)' }}>
          No trades
        </div>
      : trades.map((t: any, i: number) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 8px' }}>
          <span style={{ color: t.side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {parseFloat(t.price||0).toFixed(4)}
          </span>
          <span style={{ color: 'var(--color-text)' }}>
            {parseFloat(t.quantity||0).toFixed(4)}
          </span>
          <span style={{ color: 'var(--color-muted)' }}>
            {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))
    }
  </div>
);

export default OrderBook;
