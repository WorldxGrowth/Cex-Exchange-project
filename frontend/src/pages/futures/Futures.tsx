import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { marketAPI, futuresAPI } from '../../services/api';
import { subscribeToTicker, getSocket } from '../../services/socket';
import { ChevronDown, CandlestickChart } from 'lucide-react';
import FuturesHeader    from '../../components/futures/FuturesHeader';
import FuturesOrderBook from '../../components/futures/FuturesOrderBook';
import FuturesPositions from '../../components/futures/FuturesPositions';
import LeverageSheet    from '../../components/futures/sheets/LeverageSheet';
import MarginModeSheet  from '../../components/futures/sheets/MarginModeSheet';
import TpSlSheet        from '../../components/futures/sheets/TpSlSheet';
import CandleChart      from '../../components/chart/CandleChart';

const ORDER_TYPES = ['Market', 'Limit', 'Trigger', 'Trailing stop'] as const;
type OrderType = typeof ORDER_TYPES[number];

function useIsDesktop() {
  const [d, setD] = useState(window.innerWidth >= 1024);
  useEffect(() => {
    const h = () => setD(window.innerWidth >= 1024);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return d;
}

export default function Futures() {
  const { symbol = 'BTCUSDT' } = useParams();
  const navigate   = useNavigate();
  const { prices } = useStore();
  const desktop    = useIsDesktop();

  const [ticker, setTicker]           = useState<any>(null);
  const [orderBook, setOrderBook]     = useState<any>({ bids: [], asks: [] });
  const [fundingRate, setFundingRate] = useState(-0.005822);
  const [countdown, setCountdown]     = useState('');
  const [available, setAvailable]     = useState(0);
  const [markPrice, setMarkPrice]     = useState(0);

  const [price, setPrice]               = useState('');
  const [amount, setAmount]             = useState('');
  const [amountPct, setAmountPct]       = useState(0);
  const [amountMode, setAmountMode]     = useState<'usdt'|'qty'>('usdt');
  const [leverage, setLeverage]         = useState(5);
  const [marginMode, setMarginMode]     = useState<'cross'|'isolated'>('isolated');
  const [posMode, setPosMode]           = useState<'combined'|'separated'>('combined');
  const [orderType, setOrderType]       = useState<OrderType>('Market');
  const [openClose, setOpenClose]       = useState<'open'|'close'>('open');
  const [tpValue, setTpValue]           = useState('');
  const [slValue, setSlValue]           = useState('');
  const [tpSlEnabled, setTpSlEnabled]   = useState(false);
  const [callbackRate, setCallbackRate] = useState('1');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [showLeverage, setShowLeverage] = useState(false);
  const [showMargin, setShowMargin]     = useState(false);
  const [showTpSl, setShowTpSl]         = useState(false);
  const [placing, setPlacing]           = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [posRefresh, setPosRefresh]     = useState(0);

  const sym          = symbol.toUpperCase();
  const liveData     = prices[sym];
  const currentPrice = parseFloat(liveData?.price || ticker?.price || '0');
  const change24h    = parseFloat(liveData?.change_24h || ticker?.change_24h || '0');
  const high24h      = parseFloat(liveData?.high_24h || ticker?.high_24h || '0');
  const low24h       = parseFloat(liveData?.low_24h || ticker?.low_24h || '0');
  const vol24h       = parseFloat(liveData?.volume_24h || ticker?.volume_24h || '0');
  const isUp         = change24h >= 0;
  const baseSym      = sym.replace('USDT', '');
  const marginLabel  = `${marginMode.charAt(0).toUpperCase() + marginMode.slice(1)} (${posMode.charAt(0).toUpperCase() + posMode.slice(1)})`;

  const futuresPrice = markPrice > 0 ? markPrice : currentPrice;
  const entryPrice   = orderType === 'Market' ? futuresPrice : parseFloat(price || '0');
  const amountNum    = parseFloat(amount || '0');
  const notional     = amountMode === 'usdt' ? amountNum * leverage : amountNum * entryPrice;
  const margin       = notional / leverage;
  const fee          = notional * 0.0004;
  const cost         = margin + fee;
  const maxNotional  = available * leverage;
  const maxMargin    = available;

  const inp: any = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 12, outline: 'none', boxSizing: 'border-box'
  };

  // Countdown
  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const h = now.getUTCHours();
      const nextH = h < 8 ? 8 : h < 16 ? 16 : 24;
      const next = new Date(); next.setUTCHours(nextH, 0, 0, 0);
      const diff = next.getTime() - now.getTime();
      setCountdown([
        Math.floor(diff/3600000).toString().padStart(2,'0'),
        Math.floor((diff%3600000)/60000).toString().padStart(2,'0'),
        Math.floor((diff%60000)/1000).toString().padStart(2,'0'),
      ].join(':'));
    };
    calc(); const t = setInterval(calc, 1000); return () => clearInterval(t);
  }, []);

  const fetchBalance = useCallback(() => {
    futuresAPI.getBalance().then((res: any) => {
      const data = res?.data || res;
      const usdt = Array.isArray(data) ? data.find((b: any) => b.symbol === 'USDT') : null;
      setAvailable(parseFloat(usdt?.available || '0'));
    }).catch(() => {});
  }, []);

  const fetchFundingRate = useCallback(() => {
    futuresAPI.getFundingRates(sym).then((res: any) => {
      const data = res?.data || res;
      const rates = Array.isArray(data) ? data : [];
      if (rates.length > 0) setFundingRate(parseFloat(rates[0].rate || '-0.005822'));
    }).catch(() => {});
  }, [sym]);

  const fetchMarkPrice = useCallback(() => {
    // VDC and custom tokens are not on Binance — use spot price from store
    const customSyms = ['VDCUSDT'];
    if (customSyms.includes(sym)) {
      // Use spot price from price store for custom tokens
      return;
    }
    fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`)
      .then(r => r.json())
      .then((d: any) => { const mp = parseFloat(d?.markPrice||'0'); if (mp>0) setMarkPrice(mp); })
      .catch(() => {});
  }, [sym]);

  useEffect(() => {
    fetchBalance(); fetchFundingRate(); fetchMarkPrice();
    const t1 = setInterval(fetchBalance, 10000);
    const t2 = setInterval(fetchMarkPrice, 1000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [fetchBalance, fetchFundingRate, fetchMarkPrice]);

  // Futures OrderBook from Binance fapi every 1s
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const fetchOB = () => {
      fetch(`/api/v1/futures/orderbook/${sym}`)
        .then(r => r.json())
        .then((d: any) => {
          if (d.data?.bids && d.data?.asks) {
            setOrderBook({
              bids: d.data.bids,
              asks: d.data.asks,
            });
          }
        }).catch(() => {});
      timer = setTimeout(fetchOB, 1000);
    };
    fetchOB();
    return () => clearTimeout(timer);
  }, [sym]);

  // Slider → set amount
  useEffect(() => {
    if (amountPct === 0) return;
    if (amountMode === 'usdt') setAmount((maxMargin * amountPct / 100).toFixed(2));
    else setAmount(entryPrice > 0 ? ((maxNotional * amountPct / 100) / entryPrice).toFixed(4) : '0');
  }, [amountPct]);

  // Check if custom pair (VDC etc) from backend
  useEffect(() => {
    futuresAPI.getPairInfo(sym).then((res: any) => {
      const d = res?.data || res;
      setIsCustomPair(d?.is_custom === true);
    }).catch(() => setIsCustomPair(false));
  }, [sym]);

  // Market ticker + Socket
  useEffect(() => {
    marketAPI.getTicker(sym).then((res: any) => {
      const d = res?.data || res; setTicker(d);
      const p = parseFloat(d?.price || 0);
      if (p > 0) { setPrice(p.toFixed(2)); setTriggerPrice(p.toFixed(2)); }
    }).catch(() => {});
    subscribeToTicker(sym);
    const socket = getSocket();
    socket.on('futures_update', (data: any) => {
      if (['take_profit_hit','stop_loss_hit','position_liquidated'].includes(data.type)) {
        setSuccess(
          data.type === 'take_profit_hit' ? `✅ Take Profit hit @ ${data.symbol}` :
          data.type === 'stop_loss_hit'   ? `🛑 Stop Loss hit @ ${data.symbol}` :
          `⚠️ Liquidated ${data.symbol}`
        );
        setTimeout(() => setSuccess(''), 5000);
        setPosRefresh(r => r + 1); fetchBalance();
      }
    });
    return () => { socket.off('futures_update'); };
  }, [symbol]);

  const handleLeverageChange = async (lev: number) => {
    setLeverage(lev);
    try { await futuresAPI.changeLeverage(sym, lev); } catch(e) {}
  };

  const handleMarginChange = async (m: 'cross'|'isolated', p: 'combined'|'separated') => {
    setMarginMode(m); setPosMode(p);
    try { await futuresAPI.changeMarginType(sym, m); } catch(e) {}
  };

  const placeOrder = async (side: 'buy'|'sell') => {
    if (!amount || amountNum <= 0) { setError('Enter amount'); setTimeout(() => setError(''), 3000); return; }
    setPlacing(true); setError('');
    try {
      const _ep = orderType === 'Market' ? futuresPrice : parseFloat(price || '0');
      const _raw = amountMode === 'usdt' ? (_ep > 0 ? (amountNum * leverage) / _ep : 0) : amountNum;
      const _qty = Math.floor(_raw * 1000) / 1000;
      if (_qty <= 0) { setError('Amount too small'); setTimeout(() => setError(''), 3000); setPlacing(false); return; }
      const orderData: any = {
        symbol, side,
        order_type: orderType === 'Market' ? 'market' : orderType === 'Limit' ? 'limit'
          : orderType === 'Trigger' ? 'stop_market' : 'trailing_stop',
        quantity: _qty.toFixed(3), leverage, margin_type: marginMode,
      };
      if (orderType !== 'Market' && price)   orderData.price      = price;
      if (orderType === 'Trigger')           orderData.stop_price = triggerPrice;
      if (orderType === 'Trailing stop')     orderData.price_rate = callbackRate;
      if (tpSlEnabled && tpValue)            orderData.take_profit = tpValue;
      if (tpSlEnabled && slValue)            orderData.stop_loss   = slValue;
      await futuresAPI.placeOrder(orderData);
      setSuccess(`✅ ${side === 'buy' ? 'Long' : 'Short'} order placed!`);
      setTimeout(() => setSuccess(''), 4000);
      setAmount(''); setAmountPct(0);
      setPosRefresh(r => r + 1); fetchBalance();
    } catch(e: any) { setError(e?.message || 'Order failed'); setTimeout(() => setError(''), 4000); }
    finally { setPlacing(false); }
  };

  const renderOrderForm = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => setShowMargin(true)} style={{
          flex: 2, padding: '6px', borderRadius: 8, cursor: 'pointer', fontSize: 11,
          border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
          color: 'var(--color-text)', fontWeight: 600 }}>{marginLabel}</button>
        <button onClick={() => setShowLeverage(true)} style={{
          flex: 1, padding: '6px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
          border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
          color: 'var(--color-primary)', fontWeight: 700 }}>{leverage}x</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderRadius: 8,
                    overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {(['open','close'] as const).map(t => (
          <button key={t} onClick={() => setOpenClose(t)} style={{
            padding: '7px', border: 'none', fontSize: 12, cursor: 'pointer',
            fontWeight: openClose===t ? 600 : 400,
            background: openClose===t ? 'var(--color-surface2)' : 'transparent',
            color: openClose===t ? 'var(--color-text)' : 'var(--color-muted)'
          }}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>
      <select value={orderType} onChange={e => setOrderType(e.target.value as OrderType)} style={inp}>
        {ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      {orderType === 'Trigger' && (
        <input value={triggerPrice} onChange={e => setTriggerPrice(e.target.value)}
          type="number" placeholder="Trigger price" style={inp} />
      )}
      {orderType === 'Trailing stop' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={callbackRate} onChange={e => setCallbackRate(e.target.value)}
            type="number" placeholder="Rate %" style={{ ...inp, flex: 1 }} />
          {['1%','2%'].map(v => (
            <button key={v} onClick={() => setCallbackRate(v.replace('%',''))} style={{
              padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11,
              border: '1px solid var(--color-border)',
              background: callbackRate===v.replace('%','') ? 'var(--color-surface)' : 'var(--color-surface2)',
              color: 'var(--color-text)' }}>{v}</button>
          ))}
        </div>
      )}
      {(orderType === 'Limit' || orderType === 'Trigger') && (
        <input value={price} onChange={e => setPrice(e.target.value)}
          type="number" placeholder="Price (USDT)" style={inp} />
      )}
      <div style={{ position: 'relative' }}>
        <input value={amount} onChange={e => setAmount(e.target.value)} type="number"
          placeholder={amountMode==='usdt' ? 'Margin (USDT)' : `Qty (${baseSym})`}
          style={{ ...inp, paddingRight: 72 }} />
        <button onClick={() => { setAmount(''); setAmountPct(0); setAmountMode(m => m==='usdt'?'qty':'usdt'); }}
          style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                   padding: '3px 7px', borderRadius: 5, border: '1px solid var(--color-border)',
                   background: 'var(--color-surface)', cursor: 'pointer',
                   fontSize: 10, color: 'var(--color-primary)', fontWeight: 700 }}>
          {amountMode==='usdt' ? 'USDT' : baseSym}
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: 'var(--color-muted)' }}>Available</span>
        <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{available.toFixed(4)} USDT</span>
      </div>
      <div>
        <input type="range" min={0} max={100} value={amountPct}
          onChange={e => setAmountPct(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--color-success)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-muted)' }}>
          {[0,25,50,75,100].map(p => (
            <span key={p} onClick={() => setAmountPct(p)} style={{ cursor: 'pointer' }}>{p}%</span>
          ))}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          onClick={() => { if (!tpSlEnabled) { setTpSlEnabled(true); setShowTpSl(true); } else setTpSlEnabled(false); }}>
          <div style={{ width: 15, height: 15, borderRadius: 3, border: '1px solid var(--color-border)',
                        background: tpSlEnabled ? 'var(--color-primary)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>
            {tpSlEnabled && '✓'}
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>TP/SL</span>
        </div>
        {tpSlEnabled && (tpValue || slValue) && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {tpValue && <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(14,203,129,0.1)', fontSize: 11 }}>
              <span style={{ color: 'var(--color-muted)' }}>TP: </span>
              <span style={{ color: 'var(--color-success)' }}>{tpValue}</span>
            </div>}
            {slValue && <div style={{ flex: 1, padding: '4px 6px', borderRadius: 6, background: 'rgba(246,70,93,0.1)', fontSize: 11 }}>
              <span style={{ color: 'var(--color-muted)' }}>SL: </span>
              <span style={{ color: 'var(--color-danger)' }}>{slValue}</span>
            </div>}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: 'var(--color-muted)' }}>Max. open</span>
        <span style={{ color: 'var(--color-muted)' }}>{maxNotional > 0 ? `${maxNotional.toFixed(2)} USDT` : '-- USDT'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: 'var(--color-muted)' }}>Cost</span>
        <span style={{ color: 'var(--color-muted)' }}>{cost > 0 ? `${cost.toFixed(4)} USDT` : '-- USDT'}</span>
      </div>
      {error   && <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(246,70,93,0.15)', color: 'var(--color-danger)', fontSize: 11 }}>{error}</div>}
      {success && <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(14,203,129,0.15)', color: 'var(--color-success)', fontSize: 11 }}>{success}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: 'var(--color-muted)' }}>Max. open</span>
        <span style={{ color: 'var(--color-muted)' }}>{maxNotional > 0 ? `${maxNotional.toFixed(2)} USDT` : '-- USDT'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: 'var(--color-muted)' }}>Cost</span>
        <span style={{ color: 'var(--color-muted)' }}>{cost > 0 ? `${cost.toFixed(4)} USDT` : '-- USDT'}</span>
      </div>
      <button disabled={placing} onClick={() => placeOrder('buy')} style={{
        width: '100%', padding: '11px', borderRadius: 10, border: 'none',
        background: placing ? 'rgba(14,203,129,0.5)' : 'var(--color-success)',
        color: '#fff', fontSize: 13, fontWeight: 700, cursor: placing ? 'not-allowed' : 'pointer'
      }}>{placing ? 'Placing...' : 'Open long'}</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: 'var(--color-muted)' }}>Max. open</span>
        <span style={{ color: 'var(--color-muted)' }}>{maxNotional > 0 ? `${maxNotional.toFixed(2)} USDT` : '-- USDT'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: 'var(--color-muted)' }}>Cost</span>
        <span style={{ color: 'var(--color-muted)' }}>{cost > 0 ? `${cost.toFixed(4)} USDT` : '-- USDT'}</span>
      </div>
      <button disabled={placing} onClick={() => placeOrder('sell')} style={{
        width: '100%', padding: '11px', borderRadius: 10, border: 'none',
        background: placing ? 'rgba(246,70,93,0.5)' : 'var(--color-danger)',
        color: '#fff', fontSize: 13, fontWeight: 700, cursor: placing ? 'not-allowed' : 'pointer'
      }}>{placing ? 'Placing...' : 'Open short'}</button>
    </div>
  );

  const renderSheets = () => (
    <>
      {showLeverage && <LeverageSheet leverage={leverage}
        onConfirm={lev => { handleLeverageChange(lev); setShowLeverage(false); }}
        onClose={() => setShowLeverage(false)} />}
      {showMargin && <MarginModeSheet marginMode={marginMode} positionMode={posMode}
        onConfirm={(m, p) => { handleMarginChange(m, p); setShowMargin(false); }}
        onClose={() => setShowMargin(false)} />}
      {showTpSl && <TpSlSheet currentPrice={futuresPrice} side="long"
        onConfirm={(tp, sl) => { setTpValue(tp); setSlValue(sl); setShowTpSl(false); }}
        onClose={() => setShowTpSl(false)} />}
    </>
  );

  const mpDisplay = markPrice > 0 ? markPrice : currentPrice;

  if (!desktop) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh',
                    overflow: 'hidden', background: 'var(--color-bg)', position: 'relative' }}>
        <FuturesHeader sym={sym} baseSym={baseSym} currentPrice={mpDisplay}
          change24h={change24h} isUp={isUp} onCopyTrade={() => {}} />
        <div style={{ display: 'flex', flexShrink: 0 }}>
          <div style={{ flex: 1, maxHeight: '58vh', overflowY: 'auto' }}>{renderOrderForm()}</div>
          <div style={{ width: '44%', maxHeight: '58vh', overflowY: 'auto',
                        borderLeft: '1px solid var(--color-border)' }}>
            <FuturesOrderBook bids={orderBook.bids||[]} asks={orderBook.asks||[]}
              currentPrice={mpDisplay} isUp={isUp} countdown={countdown}
              fundingRate={fundingRate} onPriceClick={(p: string) => setPrice(p)} />
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, borderTop: '1px solid var(--color-border)' }}>
          <FuturesPositions symbol={sym} refresh={posRefresh} onRefresh={fetchBalance} />
        </div>
        {renderSheets()}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh',
                  overflow: 'hidden', background: 'var(--color-bg)' }}>
      <div style={{ height: 56, flexShrink: 0, background: 'var(--color-bg)',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '0 16px', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                      minWidth: 160, padding: '6px 10px', borderRadius: 8,
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          onClick={() => navigate('/markets?from=futures')}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>{baseSym}</span>
          <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>/USDT</span>
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4,
                         background: 'rgba(255,255,255,0.08)', color: 'var(--color-muted)' }}>Perp</span>
          <ChevronDown size={13} color="var(--color-muted)" />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800,
                      color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {mpDisplay > 0 ? mpDisplay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'}
        </div>
        <div style={{ width: 1, height: 28, background: 'var(--color-border)' }} />
        {[
          { label: '24h Change', val: `${isUp?'+':''}${change24h.toFixed(2)}%`, color: isUp ? 'var(--color-success)' : 'var(--color-danger)' },
          { label: '24h High',  val: high24h > 0 ? high24h.toFixed(2) : '---', color: 'var(--color-success)' },
          { label: '24h Low',   val: low24h > 0  ? low24h.toFixed(2)  : '---', color: 'var(--color-danger)'  },
          { label: '24h Vol',   val: vol24h > 1e6 ? `${(vol24h/1e6).toFixed(2)}M` : vol24h > 1e3 ? `${(vol24h/1e3).toFixed(2)}K` : vol24h.toFixed(2), color: 'var(--color-text)' },
          { label: 'Funding',   val: `${fundingRate.toFixed(6)}%`, color: fundingRate < 0 ? 'var(--color-danger)' : 'var(--color-success)' },
          { label: 'Countdown', val: countdown, color: 'var(--color-muted)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color }}>{val}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {['Futures','TradFi','Copy trade'].map(tab => (
            <button key={tab} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: tab==='Futures' ? 'var(--color-surface2)' : 'transparent',
              color:      tab==='Futures' ? 'var(--color-text)'     : 'var(--color-muted)'
            }}>{tab}</button>
          ))}
        </div>
        <CandlestickChart size={20} color="var(--color-muted)"
          style={{ cursor: 'pointer' }} onClick={() => navigate('/chart/'+sym)} />
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--color-border)', overflow: 'auto' }}>
          <FuturesOrderBook bids={orderBook.bids||[]} asks={orderBook.asks||[]}
            currentPrice={mpDisplay} isUp={isUp} countdown={countdown}
            fundingRate={fundingRate} onPriceClick={(p: string) => setPrice(p)} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
                      minWidth: 0, borderRight: '1px solid var(--color-border)' }}>
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <CandleChart sym={sym} currentPrice={currentPrice} />
          </div>
          <div style={{ height: 220, flexShrink: 0, borderTop: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <FuturesPositions symbol={sym} refresh={posRefresh} onRefresh={fetchBalance} />
          </div>
        </div>
        <div style={{ width: 280, flexShrink: 0, overflow: 'auto' }}>{renderOrderForm()}</div>
      </div>
      {renderSheets()}
    </div>
  );
}
