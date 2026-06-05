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

const fmtVol = (v: number) =>
  v >= 1e9 ? (v/1e9).toFixed(2)+'B' :
  v >= 1e6 ? (v/1e6).toFixed(2)+'M' :
  v >= 1e3 ? (v/1e3).toFixed(2)+'K' :
  v > 0    ? v.toFixed(2) : '--';

interface Props {
  sym: string;
  currentPrice: number;
}

export default function CandleChart({ sym, currentPrice }: Props) {
  const chartRef     = useRef<HTMLDivElement>(null);
  const chartInst    = useRef<any>(null);
  const candleSer    = useRef<any>(null);
  const volumeSer    = useRef<any>(null);

  const [activeInterval,  setActiveInterval]  = useState('1h');
  const [activeIndicator, setActiveIndicator] = useState('EMA');
  const [loading,  setLoading]  = useState(true);
  const [noData,   setNoData]   = useState(false);
  const [ema5,     setEma5]     = useState(0);
  const [ema27,    setEma27]    = useState(0);
  const [ema199,   setEma199]   = useState(0);
  const [volDisplay, setVolDisplay] = useState('--');
  const [ma5vol,   setMa5vol]   = useState('--');
  const [ma10vol,  setMa10vol]  = useState('--');

  const loadKlines = (chartCandleSer: any, chartVolSer: any, chartI: any, interval: string) => {
    setLoading(true);
    setNoData(false);

    const intervalMap: Record<string, string> = {
      'Live': '1m', '15m': '15m', '1h': '1h', '4h': '4h', '1D': '1d'
    };
    const apiInterval = intervalMap[interval] || '1h';
    const isBinance   = BINANCE_PAIRS.includes(sym);
    const fetchUrl    = isBinance
      ? '/api/v1/market/binance-klines/' + sym + '?interval=' + apiInterval + '&limit=50'
      : '/api/v1/market/klines/' + sym + '?interval=' + apiInterval + '&limit=50';

    fetch(fetchUrl)
      .then(r => r.json())
      .then((resp: any) => {
        const rawData = Array.isArray(resp) ? resp : (resp.data || []);

        if (!rawData.length) {
          chartCandleSer?.setData([]);
          chartVolSer?.setData([]);
          setNoData(true);
          setLoading(false);
          return;
        }

        let candles: any[], vols: any[];

        if (Array.isArray(resp)) {
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

        chartCandleSer?.setData(candles);
        chartVolSer?.setData(vols);
        chartI?.timeScale().fitContent();

        const closes = candles.map((c: any) => c.close);
        setEma5(calcEMA(closes, 5));
        setEma27(calcEMA(closes, 27));
        setEma199(calcEMA(closes, 199));

        const recentVols = vols.slice(-10).map((v: any) => v.value);
        const totalVol   = recentVols.reduce((a: number, b: number) => a + b, 0);
        setVolDisplay(fmtVol(recentVols[recentVols.length - 1] || 0));
        setMa5vol(fmtVol(recentVols.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5));
        setMa10vol(fmtVol(totalVol / 10));
        setLoading(false);
      })
      .catch(() => {
        chartCandleSer?.setData([]);
        chartVolSer?.setData([]);
        setNoData(true);
        setLoading(false);
      });
  };

  // ── Init chart + load data ───────────────────────
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      width:  chartRef.current.clientWidth,
      height: chartRef.current.clientHeight || 280,
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

    const cs = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81', downColor: '#f6465d',
      borderUpColor: '#0ecb81', borderDownColor: '#f6465d',
      wickUpColor: '#0ecb81', wickDownColor: '#f6465d',
    });

    const vs = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartInst.current  = chart;
    candleSer.current  = cs;
    volumeSer.current  = vs;

    // Load data immediately after chart init
    loadKlines(cs, vs, chart, activeInterval);

    const onResize = () => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartInst.current = null;
      candleSer.current = null;
      volumeSer.current = null;
    };
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
          <span style={{ color: '#f6a600' }}> {ema5 > 0 ? ema5.toFixed(4) : '--'}</span>
        </span>
        <span style={{ color: 'var(--color-muted)' }}>EMA27:
          <span style={{ color: '#e040fb' }}> {ema27 > 0 ? ema27.toFixed(4) : '--'}</span>
        </span>
        <span style={{ color: 'var(--color-muted)' }}>EMA199:
          <span style={{ color: '#29b6f6' }}> {ema199 > 0 ? ema199.toFixed(4) : '--'}</span>
        </span>
      </div>

      {/* Chart canvas */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: 'var(--color-bg)', zIndex: 10 }}>
            <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>Loading chart...</div>
          </div>
        )}
        {!loading && noData && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex',
                        flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', zIndex: 5 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div style={{ color: 'var(--color-muted)', fontSize: 14, fontWeight: 600 }}>
              No chart data available
            </div>
            <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 4 }}>
              Chart data coming soon
            </div>
          </div>
        )}
        <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '200px' }} />
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
