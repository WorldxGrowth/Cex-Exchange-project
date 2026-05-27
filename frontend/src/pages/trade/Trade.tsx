import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { marketAPI, orderAPI, walletAPI } from '../../services/api';
import { subscribeToTicker, subscribeToOrderBook, getSocket } from '../../services/socket';
import { subscribeBinanceOrderBook, unsubscribeBinanceOrderBook } from '../../services/binanceWS';
import { ChevronDown, CandlestickChart, MoreHorizontal, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

// ================================
// ORDER BOOK
// ================================
const OrderBook = ({ bids, asks, currentPrice, isUp, onPriceClick }: any) => {
  const allQtys = [
    ...asks.map((a: any) => parseFloat(a.qty) || 0),
    ...bids.map((b: any) => parseFloat(b.qty) || 0)
  ];
  const maxQty = Math.max(...allQtys, 0.001);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    padding: '4px 8px', fontSize: 11, color: 'var(--color-muted)' }}>
        <span>Price(USDT)</span><span>Amount</span>
      </div>

      {[...asks].slice(0, 8).reverse().map((ask: any, i: number) => {
        const pct = Math.min((parseFloat(ask.qty) / maxQty) * 100, 100);
        return (
          <div key={i} onClick={() => onPriceClick(parseFloat(ask.price || 0).toFixed(2))}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '2.5px 8px',
                     cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0,
                          width: `${pct}%`, background: 'rgba(246,70,93,0.12)' }} />
            <span style={{ color: 'var(--color-danger)', fontSize: 12, position: 'relative', zIndex: 1 }}>
              {parseFloat(ask.price || 0).toFixed(2)}
            </span>
            <span style={{ color: 'var(--color-text)', fontSize: 12, position: 'relative', zIndex: 1 }}>
              {parseFloat(ask.qty || 0).toFixed(4)}
            </span>
          </div>
        );
      })}

      {/* Current Price middle */}
      <div onClick={() => onPriceClick(currentPrice.toFixed(2))}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                 padding: '5px 8px', cursor: 'pointer',
                 background: isUp ? 'rgba(14,203,129,0.05)' : 'rgba(246,70,93,0.05)' }}>
        <span style={{ fontSize: 15, fontWeight: 700,
                       color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {currentPrice > 0 ? currentPrice.toLocaleString(undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>
          ≈${currentPrice > 0 ? currentPrice.toLocaleString() : '---'}
        </span>
      </div>

      {bids.slice(0, 8).map((bid: any, i: number) => {
        const pct = Math.min((parseFloat(bid.qty) / maxQty) * 100, 100);
        return (
          <div key={i} onClick={() => onPriceClick(parseFloat(bid.price || 0).toFixed(2))}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '2.5px 8px',
                     cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0,
                          width: `${pct}%`, background: 'rgba(14,203,129,0.12)' }} />
            <span style={{ color: 'var(--color-success)', fontSize: 12, position: 'relative', zIndex: 1 }}>
              {parseFloat(bid.price || 0).toFixed(2)}
            </span>
            <span style={{ color: 'var(--color-text)', fontSize: 12, position: 'relative', zIndex: 1 }}>
              {parseFloat(bid.qty || 0).toFixed(4)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ================================
// RECENT TRADES
// ================================
const RecentTrades = ({ trades }: any) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between',
                  padding: '4px 8px', fontSize: 11, color: 'var(--color-muted)' }}>
      <span>Price</span><span>Amount</span><span>Time</span>
    </div>
    {trades.length === 0
      ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-muted)', fontSize: 12 }}>No trades</div>
      : trades.map((t: any, i: number) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                               padding: '3px 8px', fontSize: 12 }}>
          <span style={{ color: t.side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {parseFloat(t.price || 0).toFixed(2)}
          </span>
          <span style={{ color: 'var(--color-text)' }}>{parseFloat(t.quantity || 0).toFixed(4)}</span>
          <span style={{ color: 'var(--color-muted)' }}>
            {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))
    }
  </div>
);

// ================================
// ORDER FORM
// ================================
const OrderForm = ({ side, setSide, orderType, setOrderType, price, setPrice,
                     quantity, setQuantity, pct, setPct, currentPrice,
                     baseSym, balances, loading, onPlace, openOrders, onCancel }: any) => {

  const [showDropdown, setShowDropdown] = useState(false);

  const availBal = side === 'buy'
    ? parseFloat(balances['USDT']?.available || 0)
    : parseFloat(balances[baseSym]?.available || 0);

  const handlePct = (p: number) => {
    setPct(p);
    if (p === 0) { setQuantity(''); return; }
    if (side === 'buy') {
      const op = parseFloat(price || String(currentPrice) || '1');
      if (op > 0) setQuantity(((availBal * p / 100) / op).toFixed(6));
    } else {
      setQuantity((availBal * p / 100).toFixed(6));
    }
  };

  const total = price && quantity && parseFloat(price) > 0 && parseFloat(quantity) > 0
    ? (parseFloat(price) * parseFloat(quantity)).toFixed(2) : '0.00';

  const inp: any = {
    width: '100%', padding: '9px 10px', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
  };

  const orderTypeLabels: any = { limit: 'Limit', market: 'Market' };

  return (
    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Buy/Sell */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                    borderRadius: 8, overflow: 'hidden',
                    border: '1px solid var(--color-border)', marginBottom: 8 }}>
        <button onClick={() => setSide('buy')} style={{
          padding: '9px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          background: side === 'buy' ? 'var(--color-success)' : 'transparent',
          color: side === 'buy' ? '#fff' : 'var(--color-muted)'
        }}>Buy</button>
        <button onClick={() => setSide('sell')} style={{
          padding: '9px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          background: side === 'sell' ? 'var(--color-danger)' : 'transparent',
          color: side === 'sell' ? '#fff' : 'var(--color-muted)'
        }}>Sell</button>
      </div>

      {/* Order type DROPDOWN - WEEX style */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <button onClick={() => setShowDropdown(!showDropdown)} style={{
          width: '100%', padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
          border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
          color: 'var(--color-text)', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span>{orderTypeLabels[orderType]}</span>
          <ChevronDown size={14} color="var(--color-muted)"
            style={{ transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                     transition: 'transform 0.2s' }} />
        </button>

        {showDropdown && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                        borderRadius: 8, marginTop: 2, overflow: 'hidden',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
            {(['limit', 'market'] as const).map(t => (
              <button key={t} onClick={() => { setOrderType(t); setShowDropdown(false); }} style={{
                width: '100%', padding: '10px 12px', border: 'none', cursor: 'pointer',
                background: orderType === t ? 'var(--color-surface2)' : 'transparent',
                color: orderType === t ? 'var(--color-primary)' : 'var(--color-text)',
                fontSize: 13, textAlign: 'left', fontWeight: orderType === t ? 600 : 400
              }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
        )}
      </div>

      {/* Available */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: 11, marginBottom: 6 }}>
        <span style={{ color: 'var(--color-muted)' }}>Avail.</span>
        <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>
          {availBal.toFixed(4)} {side === 'buy' ? 'USDT' : baseSym}
        </span>
      </div>

      {/* Price */}
      {orderType === 'limit' && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 3 }}>Price (USDT)</div>
          <div style={{ position: 'relative' }}>
            <input value={price} onChange={e => setPrice(e.target.value)} type="number" style={inp} />
            <button onClick={() => setPrice(currentPrice.toFixed(2))}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                       background: 'none', border: 'none', cursor: 'pointer',
                       color: 'var(--color-primary)', fontSize: 10, fontWeight: 700 }}>LAST</button>
          </div>
        </div>
      )}

      {/* Quantity */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 3 }}>
          Quantity ({baseSym})
        </div>
        <input value={quantity} onChange={e => setQuantity(e.target.value)}
          type="number" placeholder="0.00000" style={inp} />
      </div>

      {/* Slider */}
      <div style={{ marginBottom: 6 }}>
        <input type="range" min="0" max="100" step="1" value={pct}
          onChange={e => handlePct(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 1 }}>
          {[0, 25, 50, 75, 100].map(p => (
            <span key={p} onClick={() => handlePct(p)} style={{
              fontSize: 10, cursor: 'pointer',
              color: pct >= p && pct > 0 ? 'var(--color-primary)' : 'var(--color-muted)',
              fontWeight: pct === p ? 700 : 400
            }}>{p}%</span>
          ))}
        </div>
      </div>

      {/* Total USDT */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 3 }}>Total (USDT)</div>
        <input value={total} readOnly style={{ ...inp, color: 'var(--color-muted)' }} />
      </div>

      {/* Place Button */}
      <button onClick={onPlace} disabled={loading} style={{
        width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)',
        color: '#fff', fontSize: 14, fontWeight: 700, opacity: loading ? 0.7 : 1,
        marginBottom: 0
      }}>
        {loading ? 'Placing...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${baseSym}`}
      </button>

      {/* ===== OPEN ORDERS - Right under button ===== */}
      <div style={{ marginTop: 8, borderTop: '1px solid var(--color-border)', paddingTop: 6 }}>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4, fontWeight: 600 }}>
          Open Orders ({openOrders.length})
        </div>
        {openOrders.length === 0
          ? <div style={{ fontSize: 11, color: 'var(--color-muted)', textAlign: 'center', padding: '8px 0' }}>
              No open orders
            </div>
          : openOrders.map((o: any) => (
            <div key={o.order_id} style={{ display: 'flex', alignItems: 'center', gap: 6,
                                           padding: '5px 0', fontSize: 11,
                                           borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: o.side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)',
                             fontWeight: 700, textTransform: 'uppercase', width: 28 }}>{o.side}</span>
              <span style={{ flex: 1, color: 'var(--color-text)' }}>
                {parseFloat(o.remaining_qty || 0).toFixed(5)}
              </span>
              <span style={{ color: 'var(--color-muted)' }}>
                @{parseFloat(o.price || 0).toFixed(2)}
              </span>
              <button onClick={() => onCancel(o.order_id)} style={{
                padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-danger)',
                background: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 10
              }}>✕</button>
            </div>
          ))
        }
      </div>
    </div>
  );
};

// ================================
// MAIN TRADE PAGE
// ================================
export default function Trade() {
  const { symbol = 'BTCUSDT' } = useParams();
  const navigate = useNavigate();
  const { prices } = useStore();

  const [ticker, setTicker] = useState<any>(null);
  const [orderBook, setOrderBook] = useState<any>({ bids: [], asks: [] });
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [balances, setBalances] = useState<any>({});
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [showTrades, setShowTrades] = useState(false); // Toggle book/trades
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pct, setPct] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pairInfo, setPairInfo] = useState<any>(null);

  const sym = symbol.toUpperCase();
  const liveData = prices[sym];
  const currentPrice = parseFloat(liveData?.price || ticker?.price || '0');
  const change24h = parseFloat(liveData?.change_24h || ticker?.change_24h || '0');
  const isUp = change24h >= 0;
  const baseSym = pairInfo?.base_symbol || sym.replace('USDT', '');

  useEffect(() => {
    marketAPI.getTicker(sym).then((res: any) => {
      setTicker(res.data); setPairInfo(res.data);
      const p = parseFloat(res.data.price || 0);
      if (p > 0) setPrice(p.toFixed(2));
    });
    marketAPI.getOrderBook(sym, 15).then((res: any) => setOrderBook(res.data || { bids: [], asks: [] }));
    marketAPI.getTrades(sym).then((res: any) => setRecentTrades((res.data || []).slice(0, 30)));
    walletAPI.getBalances().then((res: any) => {
      const bal: any = {};
      (res.data?.balances || []).forEach((b: any) => {
        bal[b.symbol + '_' + b.account_type] = b;
        if (b.account_type === 'spot') bal[b.symbol] = b;
      });
      setBalances(bal);
    });
    orderAPI.getOpen(sym).then((res: any) => setOpenOrders(res.data || []));
    subscribeToTicker(sym);
    subscribeToOrderBook(sym);

    // Binance real order book
    subscribeBinanceOrderBook(sym, (data) => setOrderBook(data));

    const socket = getSocket();
    socket.on('orderbook', (data: any) => {
      if (data.symbol === sym) setOrderBook(data);
    });
    return () => { socket.off('orderbook'); unsubscribeBinanceOrderBook(); };
  }, [symbol]);

  const handlePlace = async () => {
    if (!quantity || parseFloat(quantity) <= 0) { toast.error('Enter quantity'); return; }
    if (orderType === 'limit' && (!price || parseFloat(price) <= 0)) { toast.error('Enter price'); return; }
    setLoading(true);
    try {
      await orderAPI.place({ symbol: sym, side, order_type: orderType,
        price: orderType === 'limit' ? price : undefined, quantity });
      toast.success(`${side.toUpperCase()} order placed!`);
      setQuantity(''); setPct(0);
      orderAPI.getOpen(sym).then((res: any) => setOpenOrders(res.data || []));
      walletAPI.getBalances().then((res: any) => {
        const bal: any = {};
        (res.data?.balances || []).forEach((b: any) => {
          bal[b.symbol + '_' + b.account_type] = b;
          if (b.account_type === 'spot') bal[b.symbol] = b;
        });
        setBalances(bal);
      });
    } catch (err: any) {
      toast.error(err?.message || 'Order failed');
    } finally { setLoading(false); }
  };

  const handleCancel = async (orderId: string) => {
    try {
      await orderAPI.cancel(orderId);
      toast.success('Cancelled');
      setOpenOrders(prev => prev.filter((o: any) => o.order_id !== orderId));
    } catch { toast.error('Failed'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column',
                  height: '100vh', overflow: 'hidden',
                  background: 'var(--color-bg)' }}>

      {/* ===== HEADER ===== */}
      <div style={{ background: 'var(--color-surface)', flexShrink: 0,
                    borderBottom: '1px solid var(--color-border)',
                    padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Pair + Change */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
               onClick={() => navigate('/markets')}>
            <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
              {baseSym}
            </span>
            <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>/USDT</span>
            <ChevronDown size={14} color="var(--color-muted)" />
            <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 2,
                           color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {isUp ? '+' : ''}{change24h.toFixed(2)}%
            </span>
          </div>

          {/* Right icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Toggle Book/Trades */}
            <button onClick={() => setShowTrades(!showTrades)}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                       color: showTrades ? 'var(--color-primary)' : 'var(--color-muted)',
                       fontSize: 11, display: 'flex', flexDirection: 'column',
                       alignItems: 'center', gap: 2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{ width: 4, height: 4, borderRadius: 1,
                                        background: showTrades ? 'var(--color-primary)' : 'var(--color-muted)' }} />
                ))}
              </div>
            </button>
            <CandlestickChart size={20} color="var(--color-muted)" style={{ cursor: 'pointer' }}
              onClick={() => navigate('/chart/' + sym)} />
            <MoreHorizontal size={20} color="var(--color-muted)" style={{ cursor: 'pointer' }} />
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left: Order Book OR Trades */}
        <div style={{ width: '42%', overflow: 'auto',
                      borderRight: '1px solid var(--color-border)' }}>
          {showTrades
            ? <RecentTrades trades={recentTrades} />
            : <OrderBook bids={orderBook.bids || []} asks={orderBook.asks || []}
                         currentPrice={currentPrice} isUp={isUp}
                         onPriceClick={(p: string) => setPrice(p)} />
          }
        </div>

        {/* Right: Order Form + Open Orders */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <OrderForm
            side={side} setSide={setSide}
            orderType={orderType} setOrderType={setOrderType}
            price={price} setPrice={setPrice}
            quantity={quantity} setQuantity={setQuantity}
            pct={pct} setPct={setPct}
            currentPrice={currentPrice}
            baseSym={baseSym}
            balances={balances}
            loading={loading}
            onPlace={handlePlace}
            openOrders={openOrders}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}
