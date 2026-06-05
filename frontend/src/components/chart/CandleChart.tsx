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

interface Props {
  sym: string;
  currentPrice: number;
}

export default function CandleChart({ sym, currentPrice }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  const [activeInterval, setActiveInterval] = useState('4h');
  const [activeIndicator, setActiveIndicator] = useState('EMA');
  const [loading, setLoading] = useState(true);
  const [ema5, setEma5] = useState(0);
  const [ema27, setEma27] = useState(0);
  const [ema199, setEma199] = useState(0);
  const [volDisplay, setVolDisplay] = useState('0');
  const [ma5vol, setMa5vol] = useState('0');
  const [ma10vol, setMa10vol] = useState('0');

  const isDark = document.documentElement.classList.contains('dark') ||
    !document.documentElement.classList.contains('light');

  const chartBg     = isDark ? 'transparent' : 'transparent';
  const gridColor   = isDark ? '#1e2329' : '#e8e8e8';
  const textColor   = isDark ? '#848e9c' : '#707a8a';

  // Init chart
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: chartRef.current.clientHeight,
      layout: { background: { color: chartBg }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: gridColor },
      timeScale: { borderColor: gridColor, timeVisible: true, secondsVisible: false },
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

  // Load klines
  useEffect(() => {
    setLoading(true);
    const intervalMap: Record<string, string> = {
      'Live': '1m', '15m': '15m', '1h': '1h', '4h': '4h', '1D': '1d'
    };
    const apiInterval = intervalMap[activeInterval] || '4h';

    fetch('/binance/api/v3/klines?symbol=' + sym + '&interval=' + apiInterval + '&limit=200')
      .then(r => r.json())
      .then((rawData: any) => {
        if (!Array.isArray(rawData)) throw new Error('Invalid');

        const candles = rawData.map((k: any) => ({
          time: Math.floor(k[0] / 1000) as any,
          open: parseFloat(k[1]), high: parseFloat(k[2]),
          low: parseFloat(k[3]), close: parseFloat(k[4]),
        }));
        const vols = rawData.map((k: any) => ({
          time: Math.floor(k[0] / 1000) as any,
          value: parseFloat(k[5]),
          color: parseFloat(k[4]) >= parseFloat(k[1]) ? '#0ecb8150' : '#f6465d50',
        }));

        candleSeriesRef.current?.setData(candles);
        volumeSeriesRef.current?.setData(vols);
        chartInstance.current?.timeScale().fitContent();

        const closes = candles.map((c: any) => c.close);
        setEma5(calcEMA(closes, 5));
        setEma27(calcEMA(closes, 27));
        setEma199(calcEMA(closes, 199));

        const recentVols = vols.slice(-10).map((v: any) => v.value);
        const totalVol = recentVols.reduce((a: number, b: number) => a + b, 0);
        setVolDisplay((recentVols[recentVols.length - 1] / 1000).toFixed(3));
        setMa5vol((recentVols.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5 / 1000).toFixed(3) + 'K');
        setMa10vol((totalVol / 10 / 1000).toFixed(3) + 'K');
        setLoading(false);
      })
      .catch(() => {
        // Demo fallback
        const now = Math.floor(Date.now() / 1000);
        const secs: Record<string, number> = { '1m': 60, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
        const s = secs[apiInterval] || 14400;
        let price = currentPrice || 63000;
        const demoCandles: any[] = [];
        const demoVols: any[] = [];
        for (let i = 199; i >= 0; i--) {
          const chg = (Math.random() - 0.48) * price * 0.015;
          const open = price, close = price + chg;
          const high = Math.max(open, close) * (1 + Math.random() * 0.003);
          const low = Math.min(open, close) * (1 - Math.random() * 0.003);
          demoCandles.push({ time: (now - i * s) as any, open, high, low, close });
          demoVols.push({ time: (now - i * s) as any, value: Math.random() * 500000,
            color: close >= open ? '#0ecb8150' : '#f6465d50' });
          price = close;
        }
        candleSeriesRef.current?.setData(demoCandles);
        volumeSeriesRef.current?.setData(demoVols);
        chartInstance.current?.timeScale().fitContent();
        const closes = demoCandles.map((c: any) => c.close);
        setEma5(calcEMA(closes, 5)); setEma27(calcEMA(closes, 27)); setEma199(calcEMA(closes, 199));
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
                         cursor: 'pointer', color: 'var(--color-muted)', padding: '8px', fontSize: 16 }}>⚙️</button>
      </div>

      {/* EMA row */}
      <div style={{ padding: '4px 12px', fontSize: 11, display: 'flex', gap: 12,
                    borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <span style={{ color: 'var(--color-muted)' }}>EMA5:
          <span style={{ color: '#f6a600' }}> {ema5 > 0 ? ema5.toFixed(2) : '...'}</span>
        </span>
        <span style={{ color: 'var(--color-muted)' }}>EMA27:
          <span style={{ color: '#e040fb' }}> {ema27 > 0 ? ema27.toFixed(2) : '...'}</span>
        </span>
        <span style={{ color: 'var(--color-muted)' }}>EMA199:
          <span style={{ color: '#29b6f6' }}> {ema199 > 0 ? ema199.toFixed(2) : '...'}</span>
        </span>
      </div>

      {/* Chart canvas */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: 'var(--color-bg)', zIndex: 10 }}>
            <div style={{ color: 'var(--color-muted)' }}>Loading chart...</div>
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
