import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { marketAPI } from '../../services/api';
import { useStore } from '../../store/useStore';
import { ChevronLeft, ChevronDown, RefreshCw, Bell, Star } from 'lucide-react';

const INTERVALS = ['Live', '15m', '1h', '4h', '1D', 'More'];
const INDICATORS = ['MA', 'EMA', 'BOLL', 'SAR', 'AVL', 'VOL', 'MACD'];

const calcEMA = (data: number[], period: number): number => {
  if (data.length < period) return data[data.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((s, d) => s + d, 0) / period;
  for (let i = period; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
  return ema;
};

export default function Chart() {
  const { symbol = 'BTCUSDT' } = useParams();
  const navigate = useNavigate();
  const { prices } = useStore();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  const [ticker, setTicker] = useState<any>(null);
  const [activeInterval, setActiveInterval] = useState('4h');
  const [loading, setLoading] = useState(true);
  const [activeIndicator, setActiveIndicator] = useState('EMA');
  const [bottomTab, setBottomTab] = useState<'book' | 'trades' | 'info'>('book');
  const [orderBook, setOrderBook] = useState<any>({ bids: [], asks: [] });
  const [tradesList, setTradesList] = useState<any[]>([]);
  const [starred, setStarred] = useState(false);
  const [ema5, setEma5] = useState(0);
  const [ema27, setEma27] = useState(0);
  const [ema199, setEma199] = useState(0);
  const [volDisplay, setVolDisplay] = useState('0');
  const [ma5vol, setMa5vol] = useState('0');
  const [ma10vol, setMa10vol] = useState('0');

  const sym = symbol.toUpperCase();
  const liveData = prices[sym];
  const currentPrice = parseFloat(liveData?.price || ticker?.price || '0');
  const change24h = parseFloat(liveData?.change_24h || ticker?.change_24h || '0');
  const isUp = change24h >= 0;
  const baseSym = sym.replace('USDT', '');
  const intervalMap: Record<string, string> = {
    'Live': '1m', '15m': '15m', '1h': '1h', '4h': '4h', '1D': '1d'
  };

  // Init chart once
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: chartRef.current.clientHeight,
      layout: { background: { color: 'transparent' }, textColor: '#848e9c' },
      grid: { vertLines: { color: '#1e2329' }, horzLines: { color: '#1e2329' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#1e2329' },
      timeScale: { borderColor: '#1e2329', timeVisible: true, secondsVisible: false },
    });

    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81', downColor: '#f6465d',
      borderUpColor: '#0ecb81', borderDownColor: '#f6465d',
      wickUpColor: '#0ecb81', wickDownColor: '#f6465d',
    });

    volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });
    chartInstance.current = chart;

    const onResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.remove(); };
  }, []);

  // Load data on symbol/interval change
  useEffect(() => {
    setLoading(true);
    marketAPI.getTicker(sym).then((res: any) => setTicker(res.data)).catch(() => {});
    marketAPI.getOrderBook(sym, 15).then((res: any) =>
      setOrderBook(res.data || { bids: [], asks: [] })).catch(() => {});
    marketAPI.getTrades(sym).then((res: any) =>
      setTradesList((res.data || []).slice(0, 30))).catch(() => {});

    const apiInterval = intervalMap[activeInterval] || '4h';
    const binanceUrl = '/binance/api/v3/klines?symbol=' + sym + '&interval=' + apiInterval + '&limit=200';

    fetch(binanceUrl)
      .then(r => r.json())
      .then((rawData: any) => {
        if (!Array.isArray(rawData)) throw new Error('Invalid data');

        const candles = rawData.map((k: any) => ({
          time: Math.floor(k[0] / 1000) as any,
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));

        const vols = rawData.map((k: any) => ({
          time: Math.floor(k[0] / 1000) as any,
          value: parseFloat(k[5]),
          color: parseFloat(k[4]) >= parseFloat(k[1]) ? '#0ecb8150' : '#f6465d50',
        }));

        candleSeriesRef.current?.setData(candles);
        volumeSeriesRef.current?.setData(vols);
        chartInstance.current?.timeScale().fitContent();

        // EMA
        const closes = candles.map(c => c.close);
        setEma5(calcEMA(closes, 5));
        setEma27(calcEMA(closes, 27));
        setEma199(calcEMA(closes, 199));

        // VOL stats
        const recentVols = vols.slice(-10).map(v => v.value);
        const totalVol = recentVols.reduce((a, b) => a + b, 0);
        setVolDisplay((recentVols[recentVols.length - 1] / 1000).toFixed(3));
        setMa5vol((recentVols.slice(-5).reduce((a, b) => a + b, 0) / 5 / 1000).toFixed(3) + 'K');
        setMa10vol((totalVol / 10 / 1000).toFixed(3) + 'K');

        setLoading(false);
      })
      .catch(() => {
        // Fallback: demo data
        const now = Math.floor(Date.now() / 1000);
        const secs: Record<string, number> = { '1m': 60, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
        const s = secs[apiInterval] || 14400;
        let price = currentPrice || 76000;

        const demoCandles: any[] = [];
        const demoVols: any[] = [];

        for (let i = 199; i >= 0; i--) {
          const chg = (Math.random() - 0.48) * price * 0.015;
          const open = price;
          const close = price + chg;
          const high = Math.max(open, close) * (1 + Math.random() * 0.003);
          const low = Math.min(open, close) * (1 - Math.random() * 0.003);
          const t = (now - i * s) as any;
          demoCandles.push({ time: t, open, high, low, close });
          demoVols.push({ time: t, value: Math.random() * 500000,
            color: close >= open ? '#0ecb8150' : '#f6465d50' });
          price = close;
        }

        candleSeriesRef.current?.setData(demoCandles);
        volumeSeriesRef.current?.setData(demoVols);
        chartInstance.current?.timeScale().fitContent();

        const demoCloses = demoCandles.map(c => c.close);
        setEma5(calcEMA(demoCloses, 5));
        setEma27(calcEMA(demoCloses, 27));
        setEma199(calcEMA(demoCloses, 199));
        setLoading(false);
      });
  }, [symbol, activeInterval]);

  return (
    <div style={{ background: '#0b0e11', height: '100vh', display: 'flex',
                  flexDirection: 'column', overflow: 'hidden', color: '#fff' }}>

      {/* HEADER */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #1e2329', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none',
                     cursor: 'pointer', color: '#fff', padding: 0 }}>
              <ChevronLeft size={22} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                 onClick={() => navigate('/markets')}>
              <span style={{ fontWeight: 700, fontSize: 17 }}>{baseSym}/USDT</span>
              <ChevronDown size={14} color="#848e9c" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Star size={20} fill={starred ? '#f0b90b' : 'none'}
              color={starred ? '#f0b90b' : '#848e9c'} style={{ cursor: 'pointer' }}
              onClick={() => setStarred(!starred)} />
            <RefreshCw size={18} color="#848e9c" style={{ cursor: 'pointer' }}
              onClick={() => setActiveInterval(prev => prev)} />
            <Bell size={18} color="#848e9c" style={{ cursor: 'pointer' }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700,
                          color: isUp ? '#0ecb81' : '#f6465d', lineHeight: 1 }}>
              {currentPrice > 0 ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '---'}
            </div>
            <div style={{ fontSize: 13, color: isUp ? '#0ecb81' : '#f6465d', marginTop: 2 }}>
              ≈${currentPrice > 0 ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '---'}
              {'  '}{isUp ? '+' : ''}{change24h.toFixed(2)}%
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#848e9c', textAlign: 'right', lineHeight: 1.8 }}>
            <div>24h high <span style={{ color: '#fff', marginLeft: 6 }}>
              {parseFloat(liveData?.high_24h || ticker?.high_24h || '0').toLocaleString()}
            </span></div>
            <div>24h low{'  '}<span style={{ color: '#fff', marginLeft: 6 }}>
              {parseFloat(liveData?.low_24h || ticker?.low_24h || '0').toLocaleString()}
            </span></div>
            <div>24h vol <span style={{ color: '#fff', marginLeft: 6 }}>
              {(parseFloat(liveData?.volume_24h || ticker?.volume_24h || '0') / 1000000).toFixed(2)}M
            </span></div>
          </div>
        </div>
      </div>

      {/* INTERVAL TABS */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px',
                    borderBottom: '1px solid #1e2329', flexShrink: 0 }}>
        {INTERVALS.map(iv => (
          <button key={iv} onClick={() => iv !== 'More' && setActiveInterval(iv)} style={{
            padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer',
            color: activeInterval === iv ? '#f0b90b' : '#848e9c',
            borderBottom: activeInterval === iv ? '2px solid #f0b90b' : '2px solid transparent',
            fontSize: 13, fontWeight: activeInterval === iv ? 700 : 400, whiteSpace: 'nowrap'
          }}>{iv}</button>
        ))}
        <button style={{ marginLeft: 'auto', background: 'none', border: 'none',
                         cursor: 'pointer', color: '#848e9c', padding: '8px', fontSize: 16 }}>⚙️</button>
      </div>

      {/* EMA ROW */}
      <div style={{ padding: '4px 12px', fontSize: 11, display: 'flex', gap: 12,
                    borderBottom: '1px solid #1e2329', flexShrink: 0 }}>
        <span style={{ color: '#848e9c' }}>EMA5:
          <span style={{ color: '#f6a600' }}>{ema5 > 0 ? ema5.toFixed(2) : '...'}</span>
        </span>
        <span style={{ color: '#848e9c' }}>EMA27:
          <span style={{ color: '#e040fb' }}>{ema27 > 0 ? ema27.toFixed(2) : '...'}</span>
        </span>
        <span style={{ color: '#848e9c' }}>EMA199:
          <span style={{ color: '#29b6f6' }}>{ema199 > 0 ? ema199.toFixed(2) : '...'}</span>
        </span>
      </div>

      {/* CHART */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', background: '#0b0e11', zIndex: 10 }}>
            <div style={{ color: '#848e9c' }}>Loading chart...</div>
          </div>
        )}
        <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* VOL ROW */}
      <div style={{ padding: '3px 12px', fontSize: 11, display: 'flex', gap: 12,
                    borderTop: '1px solid #1e2329', flexShrink: 0 }}>
        <span style={{ color: '#848e9c' }}>VOL:<span style={{ color: '#fff' }}> {volDisplay}</span></span>
        <span style={{ color: '#848e9c' }}>MA5:<span style={{ color: '#f6a600' }}> {ma5vol}</span></span>
        <span style={{ color: '#848e9c' }}>MA10:<span style={{ color: '#e040fb' }}> {ma10vol}</span></span>
      </div>

      {/* INDICATORS */}
      <div style={{ display: 'flex', overflowX: 'auto', padding: '6px 8px', gap: 4,
                    borderTop: '1px solid #1e2329', borderBottom: '1px solid #1e2329', flexShrink: 0 }}>
        {INDICATORS.map(ind => (
          <button key={ind} onClick={() => setActiveIndicator(ind)} style={{
            padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
            background: activeIndicator === ind ? '#1e2329' : 'none',
            color: activeIndicator === ind ? '#f0b90b' : '#848e9c',
            fontSize: 12, fontWeight: activeIndicator === ind ? 700 : 400, whiteSpace: 'nowrap'
          }}>{ind}</button>
        ))}
      </div>

      {/* BOTTOM TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e2329', flexShrink: 0 }}>
        {(['book', 'trades', 'info'] as const).map(tab => (
          <button key={tab} onClick={() => setBottomTab(tab)} style={{
            flex: 1, padding: '8px', background: 'none', border: 'none', cursor: 'pointer',
            color: bottomTab === tab ? '#fff' : '#848e9c',
            borderBottom: bottomTab === tab ? '2px solid #f0b90b' : '2px solid transparent',
            fontSize: 13, fontWeight: bottomTab === tab ? 600 : 400
          }}>
            {tab === 'book' ? 'Order Book' : tab === 'trades' ? 'Market Trades' : 'Info'}
          </button>
        ))}
      </div>

      {/* BOTTOM CONTENT */}
      <div style={{ height: 200, overflow: 'auto', flexShrink: 0 }}>
        {bottomTab === 'book' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                          padding: '6px 12px', fontSize: 11, color: '#848e9c',
                          borderBottom: '1px solid #1e2329' }}>
              <span>Amount ({baseSym})</span>
              <span style={{ textAlign: 'center' }}>
                {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ textAlign: 'right' }}>Amount ({baseSym})</span>
            </div>
            {Array.from({ length: 12 }, (_, idx) => {
              const bid = orderBook.bids?.[idx];
              const ask = orderBook.asks?.[idx];
              const bPrice = bid ? parseFloat(bid.price) : currentPrice - (idx + 1) * 0.5;
              const aPrice = ask ? parseFloat(ask.price) : currentPrice + (idx + 1) * 0.5;
              const bQty = bid ? parseFloat(bid.qty).toFixed(6) : (Math.random() * 0.5).toFixed(6);
              const aQty = ask ? parseFloat(ask.qty).toFixed(6) : (Math.random() * 0.5).toFixed(6);
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                                         padding: '3px 12px', fontSize: 12 }}>
                  <span style={{ color: '#848e9c' }}>{bQty}</span>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                    <span style={{ color: '#0ecb81' }}>{bPrice.toFixed(2)}</span>
                    <span style={{ color: '#f6465d' }}>{aPrice.toFixed(2)}</span>
                  </div>
                  <span style={{ color: '#848e9c', textAlign: 'right' }}>{aQty}</span>
                </div>
              );
            })}
          </div>
        )}

        {bottomTab === 'trades' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                          padding: '6px 12px', fontSize: 11, color: '#848e9c',
                          borderBottom: '1px solid #1e2329' }}>
              <span>Price (USDT)</span>
              <span style={{ textAlign: 'center' }}>Amount ({baseSym})</span>
              <span style={{ textAlign: 'right' }}>Time</span>
            </div>
            {(tradesList.length > 0 ? tradesList : Array.from({ length: 15 }, (_, i) => ({
              side: Math.random() > 0.5 ? 'buy' : 'sell',
              price: currentPrice + (Math.random() - 0.5) * 10,
              quantity: Math.random() * 0.5,
              created_at: new Date(Date.now() - i * 30000)
            }))).map((t: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                                     padding: '3px 12px', fontSize: 12 }}>
                <span style={{ color: t.side === 'buy' ? '#0ecb81' : '#f6465d' }}>
                  {parseFloat(t.price).toFixed(2)}
                </span>
                <span style={{ color: '#848e9c', textAlign: 'center' }}>
                  {parseFloat(t.quantity).toFixed(6)}
                </span>
                <span style={{ color: '#848e9c', textAlign: 'right' }}>
                  {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}

        {bottomTab === 'info' && (
          <div style={{ padding: '12px 16px' }}>
            {[
              { label: 'Symbol', value: sym },
              { label: 'Last Price', value: '$' + currentPrice.toLocaleString() },
              { label: '24h Change', value: change24h.toFixed(2) + '%',
                color: isUp ? '#0ecb81' : '#f6465d' },
              { label: '24h High', value: '$' + parseFloat(liveData?.high_24h || ticker?.high_24h || '0').toLocaleString() },
              { label: '24h Low', value: '$' + parseFloat(liveData?.low_24h || ticker?.low_24h || '0').toLocaleString() },
              { label: '24h Volume', value: (parseFloat(liveData?.volume_24h || ticker?.volume_24h || '0') / 1000000).toFixed(2) + 'M USDT' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                                         padding: '6px 0', borderBottom: '1px solid #1e2329', fontSize: 13 }}>
                <span style={{ color: '#848e9c' }}>{label}</span>
                <span style={{ color: color || '#fff', fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM TRADE BUTTON */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8,
                    padding: '10px 12px', borderTop: '1px solid #1e2329', flexShrink: 0 }}>
        <button onClick={() => navigate('/trade/' + sym)} style={{
          padding: '13px', borderRadius: 24, background: '#f0b90b',
          border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 15
        }}>Trade</button>
        <button style={{ padding: '13px 16px', borderRadius: 12, background: '#1e2329',
                         border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Futures</button>
        <button style={{ padding: '13px 16px', borderRadius: 12, background: '#1e2329',
                         border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13 }}>More</button>
      </div>
    </div>
  );
}
