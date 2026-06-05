import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts';

const INTERVALS = ['Live', '15m', '1h', '4h', '1D', 'More'];
const INDICATORS = ['MA', 'EMA', 'BOLL', 'SAR', 'AVL', 'VOL', 'MACD'];

const calcEMA = (data: number[], period: number): number => {
  if (data.length < period) return data[data.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((s, d) => s + d, 0) / period;
  for (let i = period; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
  return ema;
};

const BINANCE_PAIRS = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT',
  'DOGEUSDT','TRXUSDT','ADAUSDT','AVAXUSDT','LINKUSDT','DOTUSDT','SHIBUSDT',
  'LTCUSDT','UNIUSDT','ATOMUSDT','XLMUSDT','BCHUSDT','NEARUSDT','APTUSDT','ARBUSDT'];

interface Props {
  sym: string;
  currentPrice: number;
}

export default function CandleChart({ sym, currentPrice }: Props) {
  const chartRef      = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);
  const candleSeries  = useRef<any>(null);
  const volumeSeries  = useRef<any>(null);
  const initialized   = useRef(false);

  const [activeInterval, setActiveInterval] = useState('1h');
  const [activeIndicator, setActiveIndicator] = useState('EMA');
  const [loading, setLoading]   = useState(true);
  const [ema5, setEma5]         = useState(0);
  const [ema27, setEma27]       = useState(0);
  const [ema199, setEma199]     = useState(0);
  const [volDisplay, setVolDisplay] = useState('0');
  const [ma5vol, setMa5vol]     = useState('0');
  const [ma10vol, setMa10vol]   = useState('0');

  // ── Init chart ONCE ─────────────────────────────
  useEffect(() => {
    if (!chartRef.current || initialized.current) return;
    initialized.current = true;

    const chart = createChart(chartRef.current, {
      width:  chartRef.current.clientWidth,
      height: chartRef.current.clientHeight,
      layout: {
        background: { color: 'transparent' },
        textColor: '#848e9c',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    candleSeries.current = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81', downColor: '#f6465d',
      borderUpColor: '#0ecb81', borderDownColor: '#f6465d',
      wickUpColor: '#0ecb81', wickDownColor: '#f6465d',
    });

    volumeSeries.current = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartInstance.current = chart;

    const onResize = () => {
      if (chartRef.current && chartInstance.current) {
        chartInstance.current.applyOptions({
          width: chartRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      initialized.current = false;
    };
  }, []);

  // ── Load data when sym or interval changes ───────
  useEffect(() => {
    if (!candleSeries.current) return;
    setLoading(true);

    const intervalMap: Record<string, string> = {
      'Live': '1m', '15m': '15m', '1h': '1h', '4h': '4h', '1D': '1d'
    };
    const apiInterval = intervalMap[activeInterval] || '4h';
    const isBinance   = BINANCE_PAIRS.includes(sym);
    const fetchUrl    = isBinance
      ? '/binance/api/v3/klines?symbol=' + sym + '&interval=' + apiInterval + '&limit=50'
      : '/api/v1/market/klines/' + sym + '?interval=' + apiInterval + '&limit=50';

    fetch(fetchUrl)
      .then(r => r.json())
      .then((resp: any) => {
        const rawData = Array.isArray(resp) ? resp : (resp.data || []);
        if (!rawData.length) throw new Error('No data');

        let candles: any[], vols: any[];

        if (Array.isArray(resp)) {
          // Binance format
          candles = rawData.map((k: any) => ({
            time:  Math.floor(k[0] / 1000) as any,
            open:  parseFloat(k[1]),
            high:  parseFloat(k[2]),
            low:   parseFloat(k[3]),
            close: parseFloat(k[4]),
          }));
          vols = rawData.map((k: any) => ({
            time:  Math.floor(k[0] / 1000) as any,
            value: parseFloat(k[5]),
            color: parseFloat(k[4]) >= parseFloat(k[1]) ? '#0ecb8150' : '#f6465d50',
          }));
        } else {
          // Backend format
          candles = rawData.map((k: any) => ({
            time:  Math.floor(new Date(k.open_time).getTime() / 1000) as any,
            open:  parseFloat(k.open),
            high:  parseFloat(k.high),
            low:   parseFloat(k.low),
            close: parseFloat(k.close),
          }));
          vols = rawData.map((k: any) => ({
            time:  Math.floor(new Date(k.open_time).getTime() / 1000) as any,
            value: parseFloat(k.volume || '0'),
            color: parseFloat(k.close) >= parseFloat(k.open) ? '#0ecb8150' : '#f6465d50',
          }));
        }

        candleSeries.current?.setData(candles);
        volumeSeries.current?.setData(vols);
        chartInstance.current?.timeScale().fitContent();

        const closes = candles.map((c: any) => c.close);
        setEma5(calcEMA(closes, 5));
        setEma27(calcEMA(closes, 27));
        setEma199(calcEMA(closes, 199));

        // VOL stats
        const recentVols = vols.slice(-10).map((v: any) => v.value);
        const totalVol   = recentVols.reduce((a: number, b: number) => a + b, 0);
        const lastVol    = recentVols[recentVols.length - 1] || 0;
        const fmtVol = (v: number) =>
          v >= 1e9 ? (v/1e9).toFixed(2)+'B' :
          v >= 1e6 ? (v/1e6).toFixed(2)+'M' :
          v >= 1e3 ? (v/1e3).toFixed(2)+'K' : v.toFixed(2);

        setVolDisplay(fmtVol(lastVol));
        setMa5vol(fmtVol(recentVols.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5));
        setMa10vol(fmtVol(totalVol / 10));
        setLoading(false);
      })
      .catch(() => {
        // Demo fallback — 50 candles only
        const now  = Math.floor(Date.now() / 1000);
        const secs: Record<string, number> = {
          '1m': 60, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400
        };
        const s     = secs[apiInterval] || 14400;
        let price   = currentPrice || 0.30;
        const demo: any[]  = [];
        const dVols: any[] = [];

        for (let i = 49; i >= 0; i--) {
          const chg   = (Math.random() - 0.48) * price * 0.015;
          const open  = price;
          const close = Math.max(price + chg, 0.0001);
          const high  = Math.max(open, close) * (1 + Math.random() * 0.003);
          const low   = Math.min(open, close) * (1 - Math.random() * 0.003);
          demo.push({ time: (now - i * s) as any, open, high, low, close });
          dVols.push({
            time: (now - i * s) as any,
            value: Math.random() * 500000,
            color: close >= open ? '#0ecb8150' : '#f6465d50',
          });
          price = close;
        }

        candleSeries.current?.setData(demo);
        volumeSeries.current?.setData(dVols);
        chartInstance.current?.timeScale().fitContent();

        const closes = demo.map((c: any) => c.close);
        setEma5(calcEMA(closes, 5));
        setEma27(calcEMA(closes, 27));
        setEma199(calcEMA(closes, 199));
        setLoading(false);
      });
  }, [sym, activeInterval]);

  return (
    <>
      {/* Interval tabs */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px',
                    borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        {INTERVALS.map(iv => (
          <button key={iv} onClick={() => iv !== 'More' && setActiveInterval(iv)} style={{
            padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer',
            color: activeInterval === iv ? '#f0b90b' : 'var(--color-muted)',
            borderBottom: activeInterval === iv ? '2px solid #f0b90b' : '2px solid transparent',
            fontSize: 13, fontWeight: activeInterval === iv ? 700 : 400, whiteSpace: 'nowrap'
          }}>{iv}</button>
        ))}
        <button style={{ marginLeft: 'auto', background: 'none', border: 'none',
                         cursor: 'pointer', color: 'var(--color-muted)',
                         padding: '8px', fontSize: 16 }}>⚙️</button>
      </div>

      {/* EMA row */}
      <div style={{ padding: '4px 12px', fontSize: 11, display: 'flex', gap: 12,
                    borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <span style={{ color: 'var(--color-muted)' }}>EMA5:
          <span style={{ color: '#f6a600' }}> {ema5 > 0 ? ema5.toFixed(4) : '...'}</span>
        </span>
        <span style={{ color: 'var(--color-muted)' }}>EMA27:
          <span style={{ color: '#e040fb' }}> {ema27 > 0 ? ema27.toFixed(4) : '...'}</span>
        </span>
        <span style={{ color: 'var(--color-muted)' }}>EMA199:
          <span style={{ color: '#29b6f6' }}> {ema199 > 0 ? ema199.toFixed(4) : '...'}</span>
        </span>
      </div>

      {/* Chart canvas */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: 'var(--color-bg)', zIndex: 10 }}>
            <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>Loading...</div>
          </div>
        )}
        <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* VOL row */}
      <div style={{ padding: '3px 12px', fontSize: 11, display: 'flex', gap: 12,
                    borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
        <span style={{ color: 'var(--color-muted)' }}>VOL:
          <span style={{ color: 'var(--color-text)' }}> {volDisplay}</span>
        </span>
        <span style={{ color: 'var(--color-muted)' }}>MA5:
          <span style={{ color: '#f6a600' }}> {ma5vol}</span>
        </span>
        <span style={{ color: 'var(--color-muted)' }}>MA10:
          <span style={{ color: '#e040fb' }}> {ma10vol}</span>
        </span>
      </div>

      {/* Indicators */}
      <div style={{ display: 'flex', overflowX: 'auto', padding: '6px 8px', gap: 4,
                    borderTop: '1px solid var(--color-border)',
                    borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        {INDICATORS.map(ind => (
          <button key={ind} onClick={() => setActiveIndicator(ind)} style={{
            padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
            background: activeIndicator === ind ? 'var(--color-surface)' : 'none',
            color: activeIndicator === ind ? '#f0b90b' : 'var(--color-muted)',
            fontSize: 12, fontWeight: activeIndicator === ind ? 700 : 400, whiteSpace: 'nowrap'
          }}>{ind}</button>
        ))}
      </div>
    </>
  );
}
