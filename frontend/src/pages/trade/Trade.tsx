import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { marketAPI, orderAPI, walletAPI } from '../../services/api';
import { subscribeToTicker, subscribeToOrderBook, getSocket } from '../../services/socket';
import { subscribeBinanceOrderBook, unsubscribeBinanceOrderBook } from '../../services/binanceWS';
import { ChevronDown, CandlestickChart, MoreHorizontal, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

// ── OrderBook ─────────────────────────────────────
const OrderBook = ({ bids, asks, currentPrice, isUp, onPriceClick }: any) => {
  const allQtys = [
    ...asks.map((a: any) => parseFloat(a.qty)||0),
    ...bids.map((b: any) => parseFloat(b.qty)||0)
  ];
  const maxQty = Math.max(...allQtys, 0.001);

  return (
    <div style={{ fontSize: 12 }}>
      {/* Ask header */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    padding: '4px 8px', fontSize: 10,
                    color: 'var(--color-muted)' }}>
        <span>Price(USDT)</span><span>Amount</span>
      </div>

      {/* Asks - reversed */}
      {[...asks].slice(0, 8).reverse().map((ask: any, i: number) => {
        const pct = Math.min((parseFloat(ask.qty) / maxQty) * 100, 100);
        return (
          <div key={i} onClick={() => onPriceClick(parseFloat(ask.price||0).toFixed(2))}
            style={{ display: 'flex', justifyContent: 'space-between',
                     padding: '2.5px 8px', cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0,
                          width: `${pct}%`, background: 'rgba(246,70,93,0.12)' }} />
            <span style={{ color: 'var(--color-danger)', position: 'relative', zIndex: 1 }}>
              {parseFloat(ask.price||0).toFixed(2)}
            </span>
            <span style={{ color: 'var(--color-text)', position: 'relative', zIndex: 1 }}>
              {parseFloat(ask.qty||0).toFixed(4)}
            </span>
          </div>
        );
      })}

      {/* Current price row */}
      <div onClick={() => onPriceClick(currentPrice.toFixed(2))}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                 padding: '5px 8px', cursor: 'pointer',
                 background: isUp ? 'rgba(14,203,129,0.06)' : 'rgba(246,70,93,0.06)' }}>
        <span style={{ fontSize: 14, fontWeight: 800,
                       color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {currentPrice > 0 ? currentPrice.toLocaleString(undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'}
        </span>
      </div>

      {/* Bids */}
      {bids.slice(0, 8).map((bid: any, i: number) => {
        const pct = Math.min((parseFloat(bid.qty) / maxQty) * 100, 100);
        return (
          <div key={i} onClick={() => onPriceClick(parseFloat(bid.price||0).toFixed(2))}
            style={{ display: 'flex', justifyContent: 'space-between',
                     padding: '2.5px 8px', cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0,
                          width: `${pct}%`, background: 'rgba(14,203,129,0.12)' }} />
            <span style={{ color: 'var(--color-success)', position: 'relative', zIndex: 1 }}>
              {parseFloat(bid.price||0).toFixed(2)}
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

// ── Recent Trades ─────────────────────────────────
const RecentTrades = ({ trades }: any) => (
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
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                               padding: '3px 8px' }}>
          <span style={{ color: t.side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {parseFloat(t.price||0).toFixed(2)}
          </span>
          <span style={{ color: 'var(--color-text)' }}>
            {parseFloat(t.quantity||0).toFixed(4)}
          </span>
          <span style={{ color: 'var(--color-muted)' }}>
            {new Date(t.created_at).toLocaleTimeString([],
              { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))
    }
  </div>
);

// ── Main Trade ────────────────────────────────────
export default function Trade() {
  const { symbol = 'BTCUSDT' } = useParams();
  const navigate  = useNavigate();
  const { prices } = useStore();

  const [ticker, setTicker]           = useState<any>(null);
  const [orderBook, setOrderBook]     = useState<any>({ bids: [], asks: [] });
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [balances, setBalances]       = useState<any>({});
  const [openOrders, setOpenOrders]   = useState<any[]>([]);
  const [showTrades, setShowTrades]   = useState(false);
  const [bottomTab, setBottomTab]     = useState<'orders'|'assets'>('orders');
  const [side, setSide]               = useState<'buy'|'sell'>('buy');
  const [orderType, setOrderType]     = useState<'limit'|'market'>('limit');
  const [price, setPrice]             = useState('');
  const [quantity, setQuantity]       = useState('');
  const [totalInput, setTotalInput]   = useState('');
  const [pct, setPct]                 = useState(0);
  const [loading, setLoading]         = useState(false);
  const [pairInfo, setPairInfo]       = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTopTab, setActiveTopTab] = useState<'spot'|'earn'>('spot');

  // Orderbook smooth update
  const obRef = useRef<any>({ bids: [], asks: [] });

  const sym          = symbol.toUpperCase();
  const liveData     = prices[sym];
  const currentPrice = parseFloat(liveData?.price || ticker?.price || '0');
  const change24h    = parseFloat(liveData?.change_24h || ticker?.change_24h || '0');
  const isUp         = change24h >= 0;
  const baseSym      = pairInfo?.base_symbol || sym.replace('USDT', '');
  const availBal     = side === 'buy'
    ? parseFloat(balances['USDT']?.available || 0)
    : parseFloat(balances[baseSym]?.available || 0);

  // Computed total
  const computedTotal = price && quantity
    ? (parseFloat(price||'0') * parseFloat(quantity||'0')).toFixed(2)
    : totalInput || '0.00';

  const loadBalances = () => {
    walletAPI.getBalances().then((res: any) => {
      const bal: any = {};
      (res.data?.balances || []).forEach((b: any) => {
        bal[b.symbol + '_' + b.account_type] = b;
        if (b.account_type === 'spot') bal[b.symbol] = b;
      });
      setBalances(bal);
    });
  };

  useEffect(() => {
    marketAPI.getTicker(sym).then((res: any) => {
      setTicker(res.data);
      setPairInfo(res.data);
      const p = parseFloat(res.data.price || 0);
      if (p > 0) setPrice(p.toFixed(2));
    });

    marketAPI.getOrderBook(sym, 15).then((res: any) => {
      const data = res.data || { bids: [], asks: [] };
      obRef.current = data;
      setOrderBook(data);
    });

    marketAPI.getTrades(sym).then((res: any) =>
      setRecentTrades((res.data || []).slice(0, 30)));

    loadBalances();
    orderAPI.getOpen(sym).then((res: any) => setOpenOrders(res.data || []));
    subscribeToTicker(sym);
    subscribeToOrderBook(sym);

    // Binance orderbook WS
    subscribeBinanceOrderBook(sym, (data) => {
      obRef.current = data;
      setOrderBook({ ...data });
    });

    // Internal socket orderbook
    const socket = getSocket();
    socket.on('orderbook', (data: any) => {
      if (data.symbol === sym) {
        obRef.current = data;
        setOrderBook({ ...data });
      }
    });

    return () => {
      socket.off('orderbook');
      unsubscribeBinanceOrderBook();
    };
  }, [symbol]);

  // Handle percentage slider
  const handlePct = (p: number) => {
    setPct(p);
    if (p === 0) { setQuantity(''); setTotalInput(''); return; }
    const op = parseFloat(price || String(currentPrice) || '1');
    if (side === 'buy') {
      const totalAmt = (availBal * p / 100);
      setTotalInput(totalAmt.toFixed(2));
      if (op > 0) setQuantity((totalAmt / op).toFixed(6));
    } else {
      const qty = (availBal * p / 100);
      setQuantity(qty.toFixed(6));
      setTotalInput((qty * op).toFixed(2));
    }
  };

  // When quantity changes → update total
  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    const p = parseFloat(price || String(currentPrice) || '0');
    const q = parseFloat(val || '0');
    if (p > 0 && q > 0) setTotalInput((p * q).toFixed(2));
    else setTotalInput('');
  };

  // When total changes → update quantity
  const handleTotalChange = (val: string) => {
    setTotalInput(val);
    const p = parseFloat(price || String(currentPrice) || '0');
    const t = parseFloat(val || '0');
    if (p > 0 && t > 0) setQuantity((t / p).toFixed(6));
    else setQuantity('');
  };

  const handlePlace = async () => {
    if (!quantity || parseFloat(quantity) <= 0) { toast.error('Enter quantity'); return; }
    if (orderType === 'limit' && (!price || parseFloat(price) <= 0)) {
      toast.error('Enter price'); return;
    }
    setLoading(true);
    try {
      await orderAPI.place({
        symbol: sym, side, order_type: orderType,
        price: orderType === 'limit' ? price : undefined,
        quantity
      });
      toast.success(`${side.toUpperCase()} order placed!`);
      setQuantity(''); setTotalInput(''); setPct(0);
      orderAPI.getOpen(sym).then((res: any) => setOpenOrders(res.data || []));
      loadBalances();
    } catch (err: any) {
      toast.error(err?.message || 'Order failed');
    } finally { setLoading(false); }
  };

  const handleCancel = async (orderId: string) => {
    try {
      await orderAPI.cancel(orderId);
      toast.success('Cancelled');
      setOpenOrders(prev => prev.filter((o: any) => o.order_id !== orderId));
      loadBalances();
    } catch { toast.error('Failed'); }
  };

  const inp: any = {
    width: '100%', padding: '9px 10px', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
    color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh',
                  overflow: 'hidden', background: 'var(--color-bg)' }}>

      {/* ── HEADER ── */}
      <div style={{ background: 'var(--color-bg)', flexShrink: 0,
                    borderBottom: '1px solid var(--color-border)' }}>

        {/* Top tabs: Spot / Earn */}
        <div style={{ display: 'flex', padding: '8px 16px 0', gap: 20 }}>
          {(['spot', 'earn'] as const).map(tab => (
            <button key={tab} onClick={() => {
              if (tab === 'earn') { toast('Earn — Coming soon'); return; }
              setActiveTopTab(tab);
            }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, paddingBottom: 8,
              color: activeTopTab === tab ? 'var(--color-text)' : 'var(--color-muted)',
              borderBottom: activeTopTab === tab
                ? '2px solid var(--color-primary)' : '2px solid transparent',
              textTransform: 'capitalize'
            }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Symbol row */}
        <div style={{ display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', padding: '8px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            onClick={() => navigate('/markets')}>
            <span style={{ fontWeight: 800, fontSize: 17,
                           color: 'var(--color-text)' }}>{baseSym}</span>
            <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>/USDT</span>
            <ChevronDown size={14} color="var(--color-muted)" />
            <span style={{ fontSize: 12, fontWeight: 700, marginLeft: 2,
                           color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {isUp ? '+' : ''}{change24h.toFixed(2)}%
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => setShowTrades(!showTrades)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ width: 4, height: 4, borderRadius: 1,
                    background: showTrades ? 'var(--color-primary)' : 'var(--color-muted)' }} />
                ))}
              </div>
            </button>
            <CandlestickChart size={20} color="var(--color-muted)"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/chart/' + sym)} />
            <MoreHorizontal size={20} color="var(--color-muted)"
              style={{ cursor: 'pointer' }} />
          </div>
        </div>
      </div>

      {/* ── MIDDLE: OrderBook + Form ── */}
      <div style={{ display: 'flex', flexShrink: 0 }}>

        {/* LEFT: OrderBook */}
        <div style={{ width: '42%', maxHeight: '56vh', overflow: 'auto' }}>
          {showTrades
            ? <RecentTrades trades={recentTrades} />
            : <OrderBook
                bids={orderBook.bids || []}
                asks={orderBook.asks || []}
                currentPrice={currentPrice}
                isUp={isUp}
                onPriceClick={(p: string) => setPrice(p)}
              />
          }
        </div>

        {/* RIGHT: Order Form */}
        <div style={{ flex: 1, maxHeight: '56vh', overflow: 'auto', padding: '8px 10px' }}>

          {/* Buy / Sell toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                        borderRadius: 8, overflow: 'hidden',
                        border: '1px solid var(--color-border)', marginBottom: 8 }}>
            <button onClick={() => setSide('buy')} style={{
              padding: '9px', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: side === 'buy' ? 'var(--color-success)' : 'transparent',
              color: side === 'buy' ? '#fff' : 'var(--color-muted)'
            }}>Buy</button>
            <button onClick={() => setSide('sell')} style={{
              padding: '9px', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: side === 'sell' ? 'var(--color-danger)' : 'transparent',
              color: side === 'sell' ? '#fff' : 'var(--color-muted)'
            }}>Sell</button>
          </div>

          {/* Order type */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <button onClick={() => setShowDropdown(!showDropdown)} style={{
              width: '100%', padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--color-border)', background: 'var(--color-bg)',
              color: 'var(--color-text)', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span>{orderType.charAt(0).toUpperCase() + orderType.slice(1)}</span>
              <ChevronDown size={13} color="var(--color-muted)"
                style={{ transform: showDropdown ? 'rotate(180deg)' : 'none',
                         transition: '0.2s' }} />
            </button>
            {showDropdown && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 8, marginTop: 2, overflow: 'hidden',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                {(['limit', 'market'] as const).map(t => (
                  <button key={t} onClick={() => { setOrderType(t); setShowDropdown(false); }} style={{
                    width: '100%', padding: '10px 12px', border: 'none', cursor: 'pointer',
                    background: orderType === t ? 'var(--color-surface2)' : 'transparent',
                    color: orderType === t ? 'var(--color-primary)' : 'var(--color-text)',
                    fontSize: 13, textAlign: 'left',
                    fontWeight: orderType === t ? 600 : 400
                  }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
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

          {/* Price (limit only) */}
          {orderType === 'limit' && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 3 }}>
                Price (USDT)
              </div>
              <div style={{ position: 'relative' }}>
                <input value={price}
                  onChange={e => setPrice(e.target.value)}
                  type="number" style={inp} />
                <button onClick={() => setPrice(currentPrice.toFixed(2))}
                  style={{ position: 'absolute', right: 8, top: '50%',
                           transform: 'translateY(-50%)',
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
            <input value={quantity}
              onChange={e => handleQuantityChange(e.target.value)}
              type="number" placeholder="0.00000" style={inp} />
          </div>

          {/* Slider */}
          <div style={{ marginBottom: 6 }}>
            <input type="range" min="0" max="100" step="1" value={pct}
              onChange={e => handlePct(parseInt(e.target.value))}
              style={{ width: '100%',
                       accentColor: side === 'buy'
                         ? 'var(--color-success)' : 'var(--color-danger)' }} />
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

          {/* Total (USDT) — EDITABLE */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 3 }}>
              Total (USDT)
            </div>
            <input
              value={totalInput || (quantity && price
                ? (parseFloat(quantity) * parseFloat(price)).toFixed(2) : '')}
              onChange={e => handleTotalChange(e.target.value)}
              type="number" placeholder="0.00" style={inp} />
          </div>

          {/* Place order button */}
          <button onClick={handlePlace} disabled={loading} style={{
            width: '100%', padding: '12px', borderRadius: 10,
            border: 'none', cursor: 'pointer',
            background: side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)',
            color: '#fff', fontSize: 14, fontWeight: 700,
            opacity: loading ? 0.7 : 1
          }}>
            {loading ? 'Placing...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${baseSym}`}
          </button>
        </div>
      </div>

      {/* ── BOTTOM: Open Orders ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', borderTop: '1px solid var(--color-border)' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0,
                      borderBottom: '1px solid var(--color-border)',
                      background: 'var(--color-bg)' }}>
          {(['orders', 'assets'] as const).map(tab => (
            <button key={tab} onClick={() => setBottomTab(tab)} style={{
              padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
              color: bottomTab === tab ? 'var(--color-primary)' : 'var(--color-muted)',
              borderBottom: bottomTab === tab
                ? '2px solid var(--color-primary)' : '2px solid transparent',
              fontSize: 13, fontWeight: bottomTab === tab ? 600 : 400
            }}>
              {tab === 'orders' ? `Open Orders (${openOrders.length})` : 'Assets'}
            </button>
          ))}
          <button onClick={() => navigate('/orders')} style={{
            marginLeft: 'auto', padding: '8px 12px', background: 'none',
            border: 'none', cursor: 'pointer', color: 'var(--color-muted)',
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
                        background: o.side === 'buy'
                          ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)',
                        color: o.side === 'buy'
                          ? 'var(--color-success)' : 'var(--color-danger)',
                        textTransform: 'uppercase'
                      }}>{o.side}</span>
                      <span style={{ fontSize: 13, fontWeight: 600,
                                     color: 'var(--color-text)' }}>
                        {o.pair_symbol}
                      </span>
                    </div>
                    <button onClick={() => handleCancel(o.order_id)} style={{
                      padding: '4px 12px', borderRadius: 20,
                      border: '1px solid var(--color-danger)',
                      background: 'none', color: 'var(--color-danger)',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600
                    }}>Cancel</button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                fontSize: 12 }}>
                    <span style={{ color: 'var(--color-muted)' }}>
                      Price: <span style={{ color: 'var(--color-text)' }}>
                        {parseFloat(o.price||0).toFixed(2)}
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
                                          borderBottom: '1px solid var(--color-border)',
                                          fontSize: 14 }}>
                  <span style={{ color: 'var(--color-muted)' }}>{label}</span>
                  <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
