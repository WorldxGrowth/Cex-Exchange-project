import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { marketAPI } from '../../services/api';
import { subscribeToOrderBook } from '../../services/socket';
import { subscribeBinanceOrderBook, unsubscribeBinanceOrderBook } from '../../services/binanceWS';
import { subscribeToTicker, getSocket } from '../../services/socket';

import FuturesHeader    from '../../components/futures/FuturesHeader';
import FuturesOrderBook from '../../components/futures/FuturesOrderBook';
import FuturesPositions from '../../components/futures/FuturesPositions';
import LeverageSheet    from '../../components/futures/sheets/LeverageSheet';
import MarginModeSheet  from '../../components/futures/sheets/MarginModeSheet';
import TpSlSheet        from '../../components/futures/sheets/TpSlSheet';

const ORDER_TYPES = ['Market', 'Limit', 'Trigger', 'Trailing stop'] as const;
type OrderType = typeof ORDER_TYPES[number];

export default function Futures() {
  const { symbol = 'BTCUSDT' } = useParams();
  const { prices } = useStore();

  const [ticker, setTicker]           = useState<any>(null);
  const [orderBook, setOrderBook]     = useState<any>({ bids: [], asks: [] });
  const [price, setPrice]             = useState('');
  const [amount, setAmount]           = useState('');
  const [amountPct, setAmountPct]     = useState(0);
  const [leverage, setLeverage]       = useState(5);
  const [marginMode, setMarginMode]   = useState<'cross'|'isolated'>('isolated');
  const [posMode, setPosMode]         = useState<'combined'|'separated'>('combined');
  const [orderType, setOrderType]     = useState<OrderType>('Market');
  const [openClose, setOpenClose]     = useState<'open'|'close'>('open');
  const [tpValue, setTpValue]         = useState('');
  const [slValue, setSlValue]         = useState('');
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [callbackRate, setCallbackRate] = useState('1');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [countdown, setCountdown]     = useState('');

  const [showLeverage, setShowLeverage]     = useState(false);
  const [showMargin, setShowMargin]         = useState(false);
  const [showTpSl, setShowTpSl]             = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);

  const sym          = symbol.toUpperCase();
  const liveData     = prices[sym];
  const currentPrice = parseFloat(liveData?.price || ticker?.price || '0');
  const change24h    = parseFloat(liveData?.change_24h || ticker?.change_24h || '0');
  const isUp         = change24h >= 0;
  const baseSym      = sym.replace('USDT', '');

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const h = now.getUTCHours();
      const nextH = h < 8 ? 8 : h < 16 ? 16 : 24;
      const next = new Date();
      next.setUTCHours(nextH, 0, 0, 0);
      const diff = next.getTime() - now.getTime();
      const hh = Math.floor(diff / 3600000).toString().padStart(2,'0');
      const mm = Math.floor((diff % 3600000) / 60000).toString().padStart(2,'0');
      const ss = Math.floor((diff % 60000) / 1000).toString().padStart(2,'0');
      setCountdown(`${hh}:${mm}:${ss}`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Ticker
    marketAPI.getTicker(sym).then((res: any) => {
      setTicker(res.data);
      const p = parseFloat(res.data.price || 0);
      if (p > 0) { setPrice(p.toFixed(2)); setTriggerPrice(p.toFixed(2)); }
    });
    // OrderBook - REST first
    marketAPI.getOrderBook(sym, 15).then((res: any) => {
      setOrderBook(res.data || { bids: [], asks: [] });
    });
    subscribeToTicker(sym);
    subscribeToOrderBook(sym);
    // Socket live orderbook
    const socket = getSocket();
    socket.on('orderbook', (data: any) => {
      if (data.symbol === sym) setOrderBook({ ...data });
    });
    return () => {
      socket.off('orderbook');
      unsubscribeBinanceOrderBook();
    };
  }, [symbol]);

  const marginLabel = `${marginMode.charAt(0).toUpperCase() + marginMode.slice(1)} (${posMode.charAt(0).toUpperCase() + posMode.slice(1)})`;

  const inp: any = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 12, outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh',
                  overflow: 'hidden', background: 'var(--color-bg)', position: 'relative' }}>

      {/* HEADER */}
      <FuturesHeader
        sym={sym} baseSym={baseSym}
        currentPrice={currentPrice} change24h={change24h} isUp={isUp}
        onCopyTrade={() => setShowComingSoon(true)}
      />

      {/* MAIN SPLIT — flexShrink:0 like Trade page */}
      <div style={{ display: 'flex', flexShrink: 0 }}>

        {/* LEFT: Order Form */}
        <div style={{ flex: 1, maxHeight: '58vh', overflowY: 'auto', padding: '8px 8px',
                      display: 'flex', flexDirection: 'column', gap: 5 }}>

          {/* Margin + Leverage */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowMargin(true)} style={{
              flex: 2, padding: '6px', borderRadius: 8, cursor: 'pointer', fontSize: 11,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface2)', color: 'var(--color-text)', fontWeight: 600
            }}>{marginLabel}</button>
            <button onClick={() => setShowLeverage(true)} style={{
              flex: 1, padding: '6px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface2)', color: 'var(--color-primary)', fontWeight: 700
            }}>{leverage}x</button>
          </div>

          {/* Open/Close */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                        borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                        border: '1px solid var(--color-border)' }}>
            {(['open','close'] as const).map(t => (
              <button key={t} onClick={() => setOpenClose(t)} style={{
                padding: '7px', border: 'none', fontSize: 12, cursor: 'pointer',
                fontWeight: openClose === t ? 600 : 400,
                background: openClose === t ? 'var(--color-surface2)' : 'transparent',
                color: openClose === t ? 'var(--color-text)' : 'var(--color-muted)'
              }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
            ))}
          </div>

          {/* Order Type */}
          <select value={orderType}
            onChange={e => setOrderType(e.target.value as OrderType)}
            style={{ ...inp }}>
            {ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Trigger price */}
          {orderType === 'Trigger' && (
            <input value={triggerPrice} onChange={e => setTriggerPrice(e.target.value)}
              type="number" placeholder="Trigger price" style={inp} />
          )}

          {/* Callback rate */}
          {orderType === 'Trailing stop' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={callbackRate} onChange={e => setCallbackRate(e.target.value)}
                type="number" placeholder="Rate %" style={{ ...inp, flex: 1 }} />
              {['1%','2%'].map(v => (
                <button key={v} onClick={() => setCallbackRate(v.replace('%',''))} style={{
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11,
                  border: '1px solid var(--color-border)',
                  background: callbackRate === v.replace('%','')
                    ? 'var(--color-surface)' : 'var(--color-surface2)',
                  color: 'var(--color-text)'
                }}>{v}</button>
              ))}
            </div>
          )}

          {/* Limit price */}
          {(orderType === 'Limit' || orderType === 'Trigger') && (
            <input value={price} onChange={e => setPrice(e.target.value)}
              type="number" placeholder="Price (USDT)" style={inp} />
          )}

          {/* Amount */}
          <div style={{ position: 'relative' }}>
            <input value={amount} onChange={e => setAmount(e.target.value)}
              type="number" placeholder="Amount"
              style={{ ...inp, paddingRight: 55 }} />
            <div style={{ position: 'absolute', right: 8, top: '50%',
                          transform: 'translateY(-50%)', fontSize: 11,
                          color: 'var(--color-primary)', fontWeight: 600 }}>
              USDT ▼
            </div>
          </div>

          {/* Available */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--color-muted)' }}>Available</span>
            <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>0.0000 USDT ⊕</span>
          </div>

          {/* Slider */}
          <div>
            <input type="range" min={0} max={100} value={amountPct}
              onChange={e => setAmountPct(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-success)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          fontSize: 10, color: 'var(--color-muted)' }}>
              {[0,25,50,75,100].map(p => (
                <span key={p} onClick={() => setAmountPct(p)}
                  style={{ cursor: 'pointer' }}>{p}%</span>
              ))}
            </div>
          </div>

          {/* TP/SL */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                 onClick={() => {
                   if (!tpSlEnabled) { setTpSlEnabled(true); setShowTpSl(true); }
                   else setTpSlEnabled(false);
                 }}>
              <div style={{
                width: 15, height: 15, borderRadius: 3,
                border: '1px solid var(--color-border)',
                background: tpSlEnabled ? 'var(--color-primary)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9
              }}>{tpSlEnabled && '✓'}</div>
              <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>TP/SL</span>
            </div>
            {tpSlEnabled && (tpValue || slValue) && (
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                {tpValue && (
                  <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6,
                                background: 'rgba(14,203,129,0.1)', fontSize: 11 }}>
                    <span style={{ color: 'var(--color-muted)' }}>TP: </span>
                    <span style={{ color: 'var(--color-success)' }}>{tpValue}</span>
                  </div>
                )}
                {slValue && (
                  <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6,
                                background: 'rgba(246,70,93,0.1)', fontSize: 11 }}>
                    <span style={{ color: 'var(--color-muted)' }}>SL: </span>
                    <span style={{ color: 'var(--color-danger)' }}>{slValue}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Open Long section */}
          {[['Max. open','-- USDT'],['Cost','-- USDT']].map(([l,v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--color-muted)' }}>{l}</span>
              <span style={{ color: 'var(--color-muted)' }}>{v}</span>
            </div>
          ))}
          <button onClick={() => setShowComingSoon(true)} style={{
            width: '100%', padding: '11px', borderRadius: 10, border: 'none',
            background: 'var(--color-success)', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer'
          }}>Open long</button>

          {/* Open Short section */}
          {[['Max. open','-- USDT'],['Cost','-- USDT']].map(([l,v]) => (
            <div key={'s'+l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--color-muted)' }}>{l}</span>
              <span style={{ color: 'var(--color-muted)' }}>{v}</span>
            </div>
          ))}
          <button onClick={() => setShowComingSoon(true)} style={{
            width: '100%', padding: '11px', borderRadius: 10, border: 'none',
            background: 'var(--color-danger)', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer'
          }}>Open short</button>

        </div>

        {/* RIGHT: Order Book */}
        <div style={{ width: '44%', maxHeight: '58vh', overflowY: 'auto',
                      borderLeft: '1px solid var(--color-border)' }}>
          <FuturesOrderBook
            bids={orderBook.bids || []} asks={orderBook.asks || []}
            currentPrice={currentPrice} isUp={isUp}
            countdown={countdown}
            onPriceClick={(p: string) => setPrice(p)}
          />
        </div>
      </div>

      {/* BOTTOM: Positions — flex:1 remaining space */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', minHeight: 0,
                    borderTop: '1px solid var(--color-border)' }}>
        <FuturesPositions />
      </div>

      {/* Bottom Sheets */}
      {showLeverage && (
        <LeverageSheet leverage={leverage}
          onConfirm={lev => setLeverage(lev)}
          onClose={() => setShowLeverage(false)} />
      )}
      {showMargin && (
        <MarginModeSheet marginMode={marginMode} positionMode={posMode}
          onConfirm={(m, p) => { setMarginMode(m); setPosMode(p); }}
          onClose={() => setShowMargin(false)} />
      )}
      {showTpSl && (
        <TpSlSheet currentPrice={currentPrice} side="long"
          onConfirm={(tp, sl) => { setTpValue(tp); setSlValue(sl); }}
          onClose={() => setShowTpSl(false)} />
      )}

      {/* Coming Soon Modal */}
      {showComingSoon && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                      zIndex: 200, display: 'flex', alignItems: 'center',
                      justifyContent: 'center' }}
             onClick={() => setShowComingSoon(false)}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 16,
                        padding: '30px 24px', textAlign: 'center', margin: '0 20px',
                        border: '1px solid var(--color-border)' }}
               onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)',
                          marginBottom: 8 }}>Futures Coming Soon!</div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
              Futures trading is under development.{'\n'}Use Spot trading for now.
            </div>
            <button onClick={() => setShowComingSoon(false)} style={{
              padding: '12px 32px', borderRadius: 10, border: 'none',
              background: 'var(--color-primary)', color: '#000',
              fontWeight: 700, cursor: 'pointer', fontSize: 14
            }}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
