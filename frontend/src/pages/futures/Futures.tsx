import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { marketAPI } from '../../services/api';
import { ChevronDown, CandlestickChart, MoreHorizontal, Bell } from 'lucide-react';
import { subscribeBinanceOrderBook, unsubscribeBinanceOrderBook } from '../../services/binanceWS';
import { subscribeToTicker, getSocket } from '../../services/socket';

const OrderBook = ({ bids, asks, currentPrice, isUp, onPriceClick }: any) => {
  const allQtys = [...asks.map((a: any) => parseFloat(a.qty)||0),
                   ...bids.map((b: any) => parseFloat(b.qty)||0)];
  const maxQty = Math.max(...allQtys, 0.001);
  const fmt = (n: number) => n >= 1000000 ? (n/1000000).toFixed(3)+'M'
    : n >= 1000 ? (n/1000).toFixed(3)+'K' : n.toFixed(4);

  return (
    <div style={{ fontSize:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between',
                    padding:'4px 8px', fontSize:11, color:'var(--color-muted)' }}>
        <span>Price (USDT)</span><span>Amount (USDT)</span>
      </div>
      {[...asks].slice(0,7).reverse().map((ask: any, i: number) => {
        const pct = Math.min((parseFloat(ask.qty)/maxQty)*100, 100);
        return (
          <div key={i} onClick={() => onPriceClick(parseFloat(ask.price||0).toFixed(2))}
            style={{ display:'flex', justifyContent:'space-between', padding:'3px 8px',
                     cursor:'pointer', position:'relative' }}>
            <div style={{ position:'absolute', right:0, top:0, bottom:0,
                          width:`${pct}%`, background:'rgba(246,70,93,0.15)' }} />
            <span style={{ color:'var(--color-danger)', position:'relative', zIndex:1, fontWeight:500 }}>
              {parseFloat(ask.price||0).toFixed(2)}</span>
            <span style={{ color:'var(--color-text)', position:'relative', zIndex:1 }}>
              {fmt(parseFloat(ask.qty||0))}</span>
          </div>
        );
      })}
      {/* Current Price */}
      <div onClick={() => onPriceClick(currentPrice.toFixed(2))}
        style={{ display:'flex', flexDirection:'column', alignItems:'center',
                 padding:'6px 8px', cursor:'pointer',
                 background: isUp ? 'rgba(14,203,129,0.06)' : 'rgba(246,70,93,0.06)' }}>
        <span style={{ fontSize:16, fontWeight:700,
                       color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {currentPrice > 0 ? currentPrice.toLocaleString(undefined,
            {minimumFractionDigits:2, maximumFractionDigits:2}) : '---'}
        </span>
        <span style={{ fontSize:10, color:'var(--color-muted)' }}>
          ${currentPrice > 0 ? currentPrice.toLocaleString() : '---'}
        </span>
      </div>
      {bids.slice(0,7).map((bid: any, i: number) => {
        const pct = Math.min((parseFloat(bid.qty)/maxQty)*100, 100);
        return (
          <div key={i} onClick={() => onPriceClick(parseFloat(bid.price||0).toFixed(2))}
            style={{ display:'flex', justifyContent:'space-between', padding:'3px 8px',
                     cursor:'pointer', position:'relative' }}>
            <div style={{ position:'absolute', right:0, top:0, bottom:0,
                          width:`${pct}%`, background:'rgba(14,203,129,0.15)' }} />
            <span style={{ color:'var(--color-success)', position:'relative', zIndex:1, fontWeight:500 }}>
              {parseFloat(bid.price||0).toFixed(2)}</span>
            <span style={{ color:'var(--color-text)', position:'relative', zIndex:1 }}>
              {fmt(parseFloat(bid.qty||0))}</span>
          </div>
        );
      })}
    </div>
  );
};

export default function Futures() {
  const { symbol = 'BTCUSDT' } = useParams();
  const navigate = useNavigate();
  const { prices } = useStore();

  const [ticker, setTicker] = useState<any>(null);
  const [orderBook, setOrderBook] = useState<any>({ bids:[], asks:[] });
  const [pairInfo, setPairInfo] = useState<any>(null);
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState(5);
  const [orderType, setOrderType] = useState<'market'|'limit'>('market');
  const [showLeverage, setShowLeverage] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [activeBottom, setActiveBottom] = useState<'positions'|'orders'>('positions');

  const sym = symbol.toUpperCase();
  const liveData = prices[sym];
  const currentPrice = parseFloat(liveData?.price || ticker?.price || '0');
  const change24h = parseFloat(liveData?.change_24h || ticker?.change_24h || '0');
  const isUp = change24h >= 0;
  const baseSym = pairInfo?.base_symbol || sym.replace('USDT','');

  useEffect(() => {
    marketAPI.getTicker(sym).then((res: any) => {
      setTicker(res.data); setPairInfo(res.data);
      const p = parseFloat(res.data.price || 0);
      if (p > 0) setPrice(p.toFixed(2));
    });
    subscribeToTicker(sym);
    subscribeBinanceOrderBook(sym, (data) => setOrderBook(data));
    const socket = getSocket();
    return () => { socket.off('orderbook'); unsubscribeBinanceOrderBook(); };
  }, [symbol]);

  const inp: any = {
    width:'100%', padding:'10px 12px', borderRadius:8,
    border:'1px solid var(--color-border)', background:'var(--color-surface2)',
    color:'var(--color-text)', fontSize:13, outline:'none', boxSizing:'border-box'
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh',
                  overflow:'hidden', background:'var(--color-bg)' }}>

      {/* HEADER */}
      <div style={{ background:'var(--color-surface)', flexShrink:0, padding:'10px 12px',
                    borderBottom:'1px solid var(--color-border)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}
               onClick={() => navigate('/markets')}>
            <span style={{ fontWeight:700, fontSize:17, color:'var(--color-text)' }}>
              {baseSym}
            </span>
            <span style={{ color:'var(--color-muted)', fontSize:13 }}>/USDT</span>
            <ChevronDown size={14} color="var(--color-muted)" />
            <span style={{ fontSize:11, padding:'1px 6px', borderRadius:4,
                           background:'rgba(255,255,255,0.1)', color:'var(--color-muted)' }}>
              Perp
            </span>
            <span style={{ fontSize:12, fontWeight:600,
                           color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {isUp?'+':''}{change24h.toFixed(2)}%
            </span>
          </div>
          <div style={{ display:'flex', gap:14, alignItems:'center' }}>
            <CandlestickChart size={20} color="var(--color-muted)" style={{ cursor:'pointer' }}
              onClick={() => navigate('/chart/' + sym)} />
            <Bell size={20} color="var(--color-muted)" style={{ cursor:'pointer' }} />
            <MoreHorizontal size={20} color="var(--color-muted)" style={{ cursor:'pointer' }} />
          </div>
        </div>
      </div>

      {/* MAIN SPLIT */}
      <div style={{ display:'flex', flexShrink:0 }}>

        {/* LEFT: Order Form */}
        <div style={{ flex:1, maxHeight:'58vh', overflow:'auto', padding:'10px 10px' }}>

          {/* Leverage + Isolated */}
          <div style={{ display:'flex', gap:6, marginBottom:10 }}>
            <button style={{ flex:2, padding:'7px', borderRadius:8, cursor:'pointer', fontSize:12,
                             border:'1px solid var(--color-border)',
                             background:'var(--color-surface2)', color:'var(--color-text)',
                             fontWeight:600, display:'flex', alignItems:'center', gap:4,
                             justifyContent:'center' }}>
              Isolated (Combined)
            </button>
            <button onClick={() => setShowLeverage(!showLeverage)} style={{
              flex:1, padding:'7px', borderRadius:8, cursor:'pointer', fontSize:13,
              border:'1px solid var(--color-border)',
              background:'var(--color-surface2)', color:'var(--color-primary)', fontWeight:700
            }}>
              {leverage}x
            </button>
          </div>

          {/* Leverage Picker */}
          {showLeverage && (
            <div style={{ marginBottom:10, padding:'10px', borderRadius:8,
                          background:'var(--color-surface2)',
                          border:'1px solid var(--color-border)' }}>
              <div style={{ fontSize:11, color:'var(--color-muted)', marginBottom:6 }}>
                Leverage: {leverage}x
              </div>
              <input type="range" min={1} max={100} value={leverage}
                onChange={e => setLeverage(parseInt(e.target.value))}
                style={{ width:'100%', accentColor:'var(--color-primary)' }} />
              <div style={{ display:'flex', justifyContent:'space-between',
                            fontSize:10, color:'var(--color-muted)', marginTop:2 }}>
                {[1,5,10,20,50,100].map(v => (
                  <span key={v} onClick={() => setLeverage(v)} style={{ cursor:'pointer',
                    color: leverage===v ? 'var(--color-primary)' : 'var(--color-muted)',
                    fontWeight: leverage===v ? 700 : 400 }}>{v}x</span>
                ))}
              </div>
            </div>
          )}

          {/* Open/Close tabs */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr',
                        borderRadius:8, overflow:'hidden',
                        border:'1px solid var(--color-border)', marginBottom:8 }}>
            <button style={{ padding:'8px', border:'none', fontSize:13, fontWeight:600,
                             background:'var(--color-surface2)', color:'var(--color-text)',
                             cursor:'pointer' }}>Open</button>
            <button style={{ padding:'8px', border:'none', fontSize:13, fontWeight:400,
                             background:'transparent', color:'var(--color-muted)',
                             cursor:'pointer' }}>Close</button>
          </div>

          {/* Order Type */}
          <div style={{ marginBottom:8 }}>
            <select value={orderType} onChange={e => setOrderType(e.target.value as any)}
              style={{ ...inp }}>
              <option value="market">Market</option>
              <option value="limit">Limit</option>
            </select>
          </div>

          {/* Price (limit only) */}
          {orderType === 'limit' && (
            <div style={{ marginBottom:8 }}>
              <input value={price} onChange={e => setPrice(e.target.value)}
                type="number" placeholder="Price (USDT)" style={inp} />
            </div>
          )}

          {/* Amount */}
          <div style={{ marginBottom:6 }}>
            <input value={amount} onChange={e => setAmount(e.target.value)}
              type="number" placeholder="Amount" style={inp} />
          </div>

          {/* Available */}
          <div style={{ display:'flex', justifyContent:'space-between',
                        fontSize:11, marginBottom:8 }}>
            <span style={{ color:'var(--color-muted)' }}>Available</span>
            <span style={{ color:'var(--color-text)', fontWeight:600 }}>0.0000 USDT ⊕</span>
          </div>

          {/* Slider */}
          <div style={{ marginBottom:8 }}>
            <input type="range" min={0} max={100} defaultValue={0}
              style={{ width:'100%', accentColor:'var(--color-success)' }} />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10,
                          color:'var(--color-muted)', marginTop:1 }}>
              {[0,25,50,75,100].map(p => (
                <span key={p}>{p}%</span>
              ))}
            </div>
          </div>

          {/* TP/SL */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
            <div style={{ width:14, height:14, borderRadius:3,
                          border:'1px solid var(--color-border)' }} />
            <span style={{ fontSize:12, color:'var(--color-muted)' }}>TP/SL</span>
          </div>

          {/* Max open / Cost */}
          <div style={{ display:'flex', justifyContent:'space-between',
                        fontSize:11, marginBottom:4 }}>
            <span style={{ color:'var(--color-muted)' }}>Max. open</span>
            <span style={{ color:'var(--color-muted)' }}>-- USDT</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between',
                        fontSize:11, marginBottom:10 }}>
            <span style={{ color:'var(--color-muted)' }}>Cost</span>
            <span style={{ color:'var(--color-muted)' }}>-- USDT</span>
          </div>

          {/* Open Long */}
          <button onClick={() => setShowComingSoon(true)} style={{
            width:'100%', padding:'12px', borderRadius:10, border:'none',
            background:'var(--color-success)', color:'#fff',
            fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:8
          }}>
            Open long
          </button>

          {/* Max open / Cost for short */}
          <div style={{ display:'flex', justifyContent:'space-between',
                        fontSize:11, marginBottom:4 }}>
            <span style={{ color:'var(--color-muted)' }}>Max. open</span>
            <span style={{ color:'var(--color-muted)' }}>-- USDT</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between',
                        fontSize:11, marginBottom:8 }}>
            <span style={{ color:'var(--color-muted)' }}>Cost</span>
            <span style={{ color:'var(--color-muted)' }}>-- USDT</span>
          </div>

          {/* Open Short */}
          <button onClick={() => setShowComingSoon(true)} style={{
            width:'100%', padding:'12px', borderRadius:10, border:'none',
            background:'var(--color-danger)', color:'#fff',
            fontSize:14, fontWeight:700, cursor:'pointer'
          }}>
            Open short
          </button>
        </div>

        {/* RIGHT: Order Book */}
        <div style={{ width:'44%', maxHeight:'58vh', overflow:'auto',
                      borderLeft:'1px solid var(--color-border)' }}>
          <OrderBook bids={orderBook.bids||[]} asks={orderBook.asks||[]}
                     currentPrice={currentPrice} isUp={isUp}
                     onPriceClick={(p: string) => setPrice(p)} />
        </div>
      </div>

      {/* BOTTOM: Positions/Orders */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden',
                    borderTop:'1px solid var(--color-border)' }}>
        <div style={{ display:'flex', alignItems:'center', flexShrink:0,
                      background:'var(--color-surface)',
                      borderBottom:'1px solid var(--color-border)' }}>
          {[
            { key:'positions', label:'Positions (0)' },
            { key:'orders',    label:'Orders (0)' },
            { key:'copy',      label:'Copy trades' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setActiveBottom(key as any)} style={{
              padding:'8px 14px', background:'none', border:'none', cursor:'pointer',
              fontSize:12, fontWeight: activeBottom===key ? 600 : 400,
              color: activeBottom===key ? 'var(--color-primary)' : 'var(--color-muted)',
              borderBottom: activeBottom===key
                ? '2px solid var(--color-primary)' : '2px solid transparent'
            }}>{label}</button>
          ))}
          <div style={{ marginLeft:'auto', padding:'8px 12px', display:'flex',
                        alignItems:'center', gap:10 }}>
            <label style={{ display:'flex', alignItems:'center', gap:4,
                            fontSize:11, color:'var(--color-muted)', cursor:'pointer' }}>
              <input type="checkbox" style={{ accentColor:'var(--color-primary)' }} />
              Show current
            </label>
            <button style={{ padding:'4px 12px', borderRadius:8, fontSize:12, fontWeight:600,
                             border:'1px solid var(--color-border)',
                             background:'var(--color-surface2)',
                             color:'var(--color-text)', cursor:'pointer' }}>
              Close all
            </button>
          </div>
        </div>

        <div style={{ flex:1, display:'flex', flexDirection:'column',
                      alignItems:'center', justifyContent:'center',
                      color:'var(--color-muted)', fontSize:13 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
          No {activeBottom}
        </div>
      </div>

      {/* Coming Soon Modal */}
      {showComingSoon && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:200,
                      display:'flex', alignItems:'center', justifyContent:'center' }}
             onClick={() => setShowComingSoon(false)}>
          <div style={{ background:'var(--color-surface)', borderRadius:16,
                        padding:'30px 24px', textAlign:'center', margin:'0 20px',
                        border:'1px solid var(--color-border)' }}
               onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:40, marginBottom:12 }}>⚡</div>
            <div style={{ fontSize:18, fontWeight:700, color:'var(--color-text)',
                          marginBottom:8 }}>Futures Coming Soon!</div>
            <div style={{ fontSize:13, color:'var(--color-muted)', marginBottom:20 }}>
              Futures trading is under development.{'\n'}Use Spot trading for now.
            </div>
            <button onClick={() => setShowComingSoon(false)} style={{
              padding:'12px 32px', borderRadius:10, border:'none',
              background:'var(--color-primary)', color:'#000',
              fontWeight:700, cursor:'pointer', fontSize:14
            }}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
