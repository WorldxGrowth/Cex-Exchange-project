import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { marketAPI, orderAPI, walletAPI } from '../../services/api';
import { subscribeToTicker, subscribeToOrderBook, getSocket } from '../../services/socket';
import { subscribeBinanceOrderBook, unsubscribeBinanceOrderBook } from '../../services/binanceWS';
import toast from 'react-hot-toast';
import { ChevronDown, X, CandlestickChart } from 'lucide-react';

import OrderBook, { RecentTrades } from '../../components/trade/OrderBook';
import OrderForm from '../../components/trade/OrderForm';
import OpenOrders from '../../components/trade/OpenOrders';
import TradeHeader from '../../components/trade/TradeHeader';
import CandleChart from '../../components/chart/CandleChart';

function useIsDesktop() {
  const [desktop, setDesktop] = useState(window.innerWidth >= 1024);
  useEffect(() => {
    const h = () => setDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return desktop;
}

// ── Pair Picker — OUTSIDE Trade() ─────────────
interface PairPickerProps {
  sym: string;
  prices: any;
  allPairs: any[];
  onSelect: (symbol: string) => void;
  onClose: () => void;
}

function PairPicker({ sym, prices, allPairs, onSelect, onClose }: PairPickerProps) {
  const [search, setSearch] = useState('');

  const filtered = allPairs.filter(p =>
    !search ||
    p.symbol?.toLowerCase().includes(search.toLowerCase()) ||
    p.base_symbol?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999,
               background: 'rgba(0,0,0,0.75)',
               display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={onClose}>
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{ background: 'var(--color-surface)', borderRadius: 16,
                 width: 380, height: '60vh',
                 display: 'flex', flexDirection: 'column',
                 border: '1px solid var(--color-border)',
                 overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--color-border)',
                      flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Select Pair</span>
            <button onMouseDown={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-muted)', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pair..."
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10,
                     border: '1px solid var(--color-border)',
                     background: 'var(--color-bg)', color: 'var(--color-text)',
                     fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'scroll', overflowX: 'hidden' }}>
          {filtered.map((p: any) => {
            const live = prices[p.symbol];
            const pr   = parseFloat(live?.price || p.price || '0');
            const ch   = parseFloat(live?.change_24h || p.change_24h || '0');
            const up   = ch >= 0;
            const active = p.symbol === sym;
            return (
              <div key={p.symbol}
                onMouseDown={() => onSelect(p.symbol)}
                style={{ display: 'flex', alignItems: 'center',
                         justifyContent: 'space-between',
                         padding: '12px 16px', cursor: 'pointer',
                         borderBottom: '1px solid var(--color-border)',
                         background: active ? 'rgba(240,185,11,0.08)' : 'transparent',
                         userSelect: 'none' as const }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface2)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = active
                    ? 'rgba(240,185,11,0.08)' : 'transparent';
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {p.base_logo
                    ? <img src={p.base_logo} alt=""
                        style={{ width: 32, height: 32, borderRadius: '50%' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    : <div style={{ width: 32, height: 32, borderRadius: '50%',
                                    background: 'var(--color-bg)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 700, color: 'var(--color-primary)', fontSize: 13 }}>
                        {p.base_symbol?.charAt(0)}
                      </div>
                  }
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      <span style={{ color: active ? 'var(--color-primary)' : 'var(--color-text)' }}>
                        {p.base_symbol}
                      </span>
                      <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: 12 }}>
                        /USDT
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                      Vol {(parseFloat(p.volume_24h||0)/1e6).toFixed(2)}M
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>
                    {pr > 0 ? pr.toLocaleString(undefined,
                      { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '---'}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600,
                                color: up ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {up ? '+' : ''}{ch.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Trade Component ───────────────────────
export default function Trade() {
  const { symbol = 'BTCUSDT' } = useParams();
  const navigate = useNavigate();
  const { prices } = useStore();
  const desktop = useIsDesktop();

  const [ticker, setTicker]             = useState<any>(null);
  const [orderBook, setOrderBook]       = useState<any>({ bids: [], asks: [] });
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [balances, setBalances]         = useState<any>({});
  const [openOrders, setOpenOrders]     = useState<any[]>([]);
  const [showTrades, setShowTrades]     = useState(false);
  const [bottomTab, setBottomTab]       = useState<'orders'|'assets'>('orders');
  const [side, setSide]                 = useState<'buy'|'sell'>('buy');
  const [orderType, setOrderType]       = useState<'limit'|'market'>('limit');
  const [price, setPrice]               = useState('');
  const [quantity, setQuantity]         = useState('');
  const [totalInput, setTotalInput]     = useState('');
  const [pct, setPct]                   = useState(0);
  const [loading, setLoading]           = useState(false);
  const [pairInfo, setPairInfo]         = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTopTab, setActiveTopTab] = useState<'spot'|'earn'>('spot');
  const [allPairs, setAllPairs]         = useState<any[]>([]);
  const [showPairPicker, setShowPairPicker] = useState(false);
  const obRef = useRef<any>({ bids: [], asks: [] });

  const sym          = symbol.toUpperCase();
  const liveData     = prices[sym];
  const currentPrice = parseFloat(liveData?.price || ticker?.price || '0');
  const change24h    = parseFloat(liveData?.change_24h || ticker?.change_24h || '0');
  const high24h      = parseFloat(liveData?.high_24h  || ticker?.high_24h   || '0');
  const low24h       = parseFloat(liveData?.low_24h   || ticker?.low_24h    || '0');
  const vol24h       = parseFloat(liveData?.volume_24h|| ticker?.volume_24h  || '0');
  const isUp         = change24h >= 0;
  const baseSym      = pairInfo?.base_symbol || sym.replace('USDT', '');
  const availBal     = side === 'buy'
    ? parseFloat(balances['USDT']?.available || 0)
    : parseFloat(balances[baseSym]?.available || 0);

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
    marketAPI.getPairs().then((res: any) => {
      setAllPairs((res.data || []).filter((p: any) => p.is_active));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    marketAPI.getTicker(sym).then((res: any) => {
      setTicker(res.data); setPairInfo(res.data);
      const p = parseFloat(res.data.price || 0);
      if (p > 0) setPrice(p.toFixed(4));
    });
    marketAPI.getOrderBook(sym, 15).then((res: any) => {
      const data = res.data || { bids: [], asks: [] };
      obRef.current = data; setOrderBook(data);
    });
    marketAPI.getTrades(sym).then((res: any) =>
      setRecentTrades((res.data || []).slice(0, 30)));
    loadBalances();
    orderAPI.getOpen(sym).then((res: any) => setOpenOrders(res.data || []));
    subscribeToTicker(sym);
    subscribeToOrderBook(sym);
    subscribeBinanceOrderBook(sym, (data) => {
      obRef.current = data; setOrderBook({ ...data });
    });
    const socket = getSocket();
    socket.on('orderbook', (data: any) => {
      if (data.symbol === sym) { obRef.current = data; setOrderBook({ ...data }); }
    });
    socket.on('order_update', (data: any) => {
      if (data.status === 'filled' || data.status === 'cancelled') {
        setOpenOrders((prev: any[]) => prev.filter((o: any) => o.order_id !== data.order_id));
        if (data.status === 'filled') loadBalances();
      } else if (data.status === 'partially_filled') {
        setOpenOrders((prev: any[]) => prev.map((o: any) =>
          o.order_id === data.order_id ? { ...o, ...data } : o
        ));
      }
    });
    const pollTimer = setInterval(() => {
      orderAPI.getOpen(sym).then((res: any) => setOpenOrders(res.data || []));
    }, 30000);
    return () => {
      socket.off('orderbook'); socket.off('order_update');
      clearInterval(pollTimer); unsubscribeBinanceOrderBook();
    };
  }, [symbol]);

  const handlePct = (p: number) => {
    setPct(p);
    if (p === 0) { setQuantity(''); setTotalInput(''); return; }
    const op = parseFloat(price || String(currentPrice) || '1');
    if (side === 'buy') {
      const totalAmt = availBal * p / 100;
      setTotalInput(totalAmt.toFixed(2));
      if (op > 0) setQuantity((totalAmt / op).toFixed(6));
    } else {
      const qty = availBal * p / 100;
      setQuantity(qty.toFixed(6));
      setTotalInput((qty * op).toFixed(2));
    }
  };

  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    const p = parseFloat(price || String(currentPrice) || '0');
    const q = parseFloat(val || '0');
    if (p > 0 && q > 0) setTotalInput((p * q).toFixed(2));
    else setTotalInput('');
  };

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
      const res: any = await orderAPI.place({
        symbol: sym, side, order_type: orderType,
        price: orderType === 'limit' ? price : undefined, quantity
      });
      const order = res.data;
      if (order?.status === 'filled') {
        toast.success(`✅ ${side.toUpperCase()} filled @ ${parseFloat(order.avg_fill_price||order.price||0).toFixed(4)}`);
      } else if (order?.status === 'open' || order?.status === 'partially_filled') {
        toast.success(`${side.toUpperCase()} order placed!`);
        setOpenOrders((prev: any[]) => [order, ...prev]);
      } else {
        toast.success(`${side.toUpperCase()} order placed!`);
      }
      setQuantity(''); setTotalInput(''); setPct(0);
      loadBalances();
      setTimeout(() => {
        orderAPI.getOpen(sym).then((res: any) => setOpenOrders(res.data || []));
        loadBalances();
      }, 2000);
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

  const handlePairSelect = (newSym: string) => {
    navigate(`/trade/${newSym}`);
    setShowPairPicker(false);
  };

  // ── MOBILE LAYOUT ──────────────────────────────
  if (!desktop) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh',
                    overflow: 'hidden', background: 'var(--color-bg)' }}>
        <TradeHeader
          baseSym={baseSym} change24h={change24h} isUp={isUp}
          showTrades={showTrades} activeTopTab={activeTopTab} sym={sym}
          onToggleTrades={() => setShowTrades(!showTrades)}
          onTopTabChange={setActiveTopTab}
        />
        <div style={{ display: 'flex', flexShrink: 0 }}>
          <div style={{ width: '42%', maxHeight: '56vh', overflow: 'auto' }}>
            {showTrades
              ? <RecentTrades trades={recentTrades} />
              : <OrderBook bids={orderBook.bids||[]} asks={orderBook.asks||[]}
                  currentPrice={currentPrice} isUp={isUp} showTrades={showTrades}
                  trades={recentTrades} onPriceClick={(p: string) => setPrice(p)} />
            }
          </div>
          <OrderForm
            side={side} orderType={orderType} price={price} quantity={quantity}
            totalInput={totalInput} pct={pct} loading={loading} availBal={availBal}
            baseSym={baseSym} currentPrice={currentPrice} showDropdown={showDropdown}
            onSideChange={setSide}
            onOrderTypeChange={(t) => { setOrderType(t); setShowDropdown(false); }}
            onPriceChange={setPrice} onQuantityChange={handleQuantityChange}
            onTotalChange={handleTotalChange} onPctChange={handlePct}
            onPlace={handlePlace} onDropdownToggle={() => setShowDropdown(!showDropdown)}
          />
        </div>
        <OpenOrders
          openOrders={openOrders} bottomTab={bottomTab}
          balances={balances} baseSym={baseSym}
          onTabChange={setBottomTab} onCancel={handleCancel}
        />
        {showPairPicker && (
          <PairPicker
            sym={sym} prices={prices} allPairs={allPairs}
            onSelect={handlePairSelect}
            onClose={() => setShowPairPicker(false)}
          />
        )}
      </div>
    );
  }

  // ── DESKTOP LAYOUT ────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh',
                  overflow: 'hidden', background: 'var(--color-bg)' }}>

      {/* Sticky Header */}
      <div style={{ background: 'var(--color-bg)', flexShrink: 0,
                    borderBottom: '1px solid var(--color-border)',
                    padding: '0 16px', display: 'flex', alignItems: 'center',
                    gap: 20, height: 56, position: 'sticky', top: 0, zIndex: 100 }}>

        {/* Symbol Picker Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                      minWidth: 160, padding: '6px 10px', borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)', transition: 'background 0.15s' }}
          onMouseDown={() => setShowPairPicker(true)}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}>
          {pairInfo?.base_logo && (
            <img src={pairInfo.base_logo} alt=""
              style={{ width: 22, height: 22, borderRadius: '50%' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
          <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-text)' }}>
            {baseSym}
          </span>
          <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>/USDT</span>
          <ChevronDown size={14} color="var(--color-muted)" />
        </div>

        {/* Price */}
        <div style={{ fontSize: 20, fontWeight: 800,
                      color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {currentPrice > 0 ? currentPrice.toLocaleString(undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '---'}
        </div>

        <div style={{ width: 1, height: 32, background: 'var(--color-border)' }} />

        {[
          { label: '24h Change', val: `${isUp?'+':''}${change24h.toFixed(2)}%`,
            color: isUp ? 'var(--color-success)' : 'var(--color-danger)' },
          { label: '24h High', val: high24h > 0 ? high24h.toFixed(4) : '---',
            color: 'var(--color-success)' },
          { label: '24h Low',  val: low24h > 0 ? low24h.toFixed(4) : '---',
            color: 'var(--color-danger)' },
          { label: '24h Vol',  val: vol24h > 1e6 ? `${(vol24h/1e6).toFixed(2)}M`
            : vol24h > 1e3 ? `${(vol24h/1e3).toFixed(2)}K` : vol24h.toFixed(2),
            color: 'var(--color-text)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color }}>{val}</span>
          </div>
        ))}

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {(['spot', 'earn'] as const).map(tab => (
            <button key={tab} onClick={() => {
              if (tab === 'earn') { toast('Earn — Coming soon'); return; }
              setActiveTopTab(tab);
            }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, paddingBottom: 2,
              color: activeTopTab === tab ? 'var(--color-text)' : 'var(--color-muted)',
              borderBottom: activeTopTab === tab
                ? '2px solid var(--color-primary)' : '2px solid transparent',
            }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
          <CandlestickChart size={20} color="var(--color-muted)"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/chart/' + sym)} />
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* LEFT: OrderBook */}
        <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--color-border)',
                      display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)',
                        flexShrink: 0 }}>
            {[{k: false, l: 'Book'}, {k: true, l: 'Trades'}].map(({k, l}) => (
              <button key={l} onClick={() => setShowTrades(k)} style={{
                flex: 1, padding: '8px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: showTrades === k ? 'var(--color-primary)' : 'var(--color-muted)',
                borderBottom: showTrades === k
                  ? '2px solid var(--color-primary)' : '2px solid transparent'
              }}>{l}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {showTrades
              ? <RecentTrades trades={recentTrades} />
              : <OrderBook bids={orderBook.bids||[]} asks={orderBook.asks||[]}
                  currentPrice={currentPrice} isUp={isUp} showTrades={showTrades}
                  trades={recentTrades} onPriceClick={(p: string) => setPrice(p)} />
            }
          </div>
        </div>

        {/* MIDDLE: Chart + Orders */}
        <div style={{ flex: 1, borderRight: '1px solid var(--color-border)',
                      display: 'flex', flexDirection: 'column',
                      overflow: 'hidden', minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                        overflow: 'hidden', minHeight: 0 }}>
            <CandleChart sym={sym} currentPrice={currentPrice} />
          </div>
          <div style={{ height: 200, borderTop: '1px solid var(--color-border)',
                        overflow: 'hidden', display: 'flex', flexDirection: 'column',
                        flexShrink: 0 }}>
            <OpenOrders
              openOrders={openOrders} bottomTab={bottomTab}
              balances={balances} baseSym={baseSym}
              onTabChange={setBottomTab} onCancel={handleCancel}
            />
          </div>
        </div>

        {/* RIGHT: Form */}
        <div style={{ width: 300, flexShrink: 0, overflow: 'auto',
                      borderLeft: '1px solid var(--color-border)' }}>
          <OrderForm
            side={side} orderType={orderType} price={price} quantity={quantity}
            totalInput={totalInput} pct={pct} loading={loading} availBal={availBal}
            baseSym={baseSym} currentPrice={currentPrice} showDropdown={showDropdown}
            onSideChange={setSide}
            onOrderTypeChange={(t) => { setOrderType(t); setShowDropdown(false); }}
            onPriceChange={setPrice} onQuantityChange={handleQuantityChange}
            onTotalChange={handleTotalChange} onPctChange={handlePct}
            onPlace={handlePlace} onDropdownToggle={() => setShowDropdown(!showDropdown)}
          />
        </div>
      </div>

      {/* Pair Picker */}
      {showPairPicker && (
        <PairPicker
          sym={sym} prices={prices} allPairs={allPairs}
          onSelect={handlePairSelect}
          onClose={() => setShowPairPicker(false)}
        />
      )}
    </div>
  );
}
