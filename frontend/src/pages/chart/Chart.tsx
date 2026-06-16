import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { marketAPI } from '../../services/api';
import { Plus, ChevronLeft, ChevronDown, Star, RefreshCw } from 'lucide-react';

import CandleChart from '../../components/chart/CandleChart';
import ChartBottomTabs from '../../components/chart/ChartBottomTabs';
import ChartHeader from '../../components/chart/ChartHeader';
import QuickOrderSheet from '../../components/chart/QuickOrderSheet';

function useIsDesktop() {
  const [d, setD] = useState(window.innerWidth >= 1024);
  useEffect(() => {
    const h = () => setD(window.innerWidth >= 1024);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return d;
}

export default function Chart() {
  const { symbol = 'BTCUSDT' } = useParams();
  const navigate = useNavigate();
  const { prices } = useStore();
  const desktop = useIsDesktop();

  const [ticker, setTicker]         = useState<any>(null);
  const [orderBook, setOrderBook]   = useState<any>({ bids: [], asks: [] });
  const [tradesList, setTradesList] = useState<any[]>([]);
  const [bottomTab, setBottomTab]   = useState<'book'|'trades'|'info'>('book');
  const [starred, setStarred]       = useState(false);
  const [showOrder, setShowOrder]   = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const sym          = symbol.toUpperCase();
  const liveData     = prices[sym];
  const currentPrice = parseFloat(liveData?.price || ticker?.price || '0');
  const change24h    = parseFloat(liveData?.change_24h || ticker?.change_24h || '0');
  const isUp         = change24h >= 0;
  const baseSym      = sym.replace('USDT', '');
  const high24h      = parseFloat(liveData?.high_24h || ticker?.high_24h || '0');
  const low24h       = parseFloat(liveData?.low_24h || ticker?.low_24h || '0');
  const volume24h    = parseFloat(liveData?.volume_24h || ticker?.volume_24h || '0');

  useEffect(() => {
    marketAPI.getTicker(sym).then((res: any) => setTicker(res.data)).catch(() => {});
    marketAPI.getOrderBook(sym, 15).then((res: any) =>
      setOrderBook(res.data || { bids: [], asks: [] })).catch(() => {});
    marketAPI.getTrades(sym).then((res: any) =>
      setTradesList((res.data || []).slice(0, 30))).catch(() => {});
  }, [sym, refreshKey]);

  // ── MOBILE LAYOUT (unchanged) ──────────────────
  if (!desktop) {
    return (
      <div style={{ background: 'var(--color-bg)', height: '100vh',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', color: 'var(--color-text)' }}>
        <ChartHeader
          baseSym={baseSym} sym={sym}
          currentPrice={currentPrice} change24h={change24h} isUp={isUp}
          high24h={high24h} low24h={low24h} volume24h={volume24h}
          starred={starred}
          onStarToggle={() => setStarred(!starred)}
          onRefresh={() => setRefreshKey(k => k + 1)}
        />
        <CandleChart sym={sym} currentPrice={currentPrice} />
        <ChartBottomTabs
          bottomTab={bottomTab} baseSym={baseSym} sym={sym}
          currentPrice={currentPrice} change24h={change24h} isUp={isUp}
          high24h={high24h} low24h={low24h} volume24h={volume24h}
          orderBook={orderBook} tradesList={tradesList}
          onTabChange={setBottomTab}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8,
                      padding: '10px 12px', borderTop: '1px solid var(--color-border)',
                      flexShrink: 0, background: 'var(--color-bg)' }}>
          <button onClick={() => setShowOrder(true)} style={{
            padding: '13px', borderRadius: 24, background: 'var(--color-primary)',
            border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}>
            <Plus size={18} />Trade
          </button>
          <button style={{ padding: '13px 16px', borderRadius: 12,
                           background: 'var(--color-surface)', border: 'none',
                           color: 'var(--color-text)', cursor: 'pointer', fontSize: 13 }}>
            Futures
          </button>
          <button style={{ padding: '13px 16px', borderRadius: 12,
                           background: 'var(--color-surface)', border: 'none',
                           color: 'var(--color-text)', cursor: 'pointer', fontSize: 13 }}>
            More
          </button>
        </div>
        {showOrder && (
          <QuickOrderSheet
            sym={sym} baseSym={baseSym} currentPrice={currentPrice}
            onClose={() => setShowOrder(false)}
            onSuccess={() => setRefreshKey(k => k + 1)}
          />
        )}
      </div>
    );
  }

  // ── DESKTOP LAYOUT (Full width chart, clean) ───
  return (
    <div style={{ background: 'var(--color-bg)', height: '100vh',
                  display: 'flex', flexDirection: 'column',
                  overflow: 'hidden', color: 'var(--color-text)' }}>

      {/* Slim Desktop Header */}
      <div style={{ padding: '0 20px', height: 52, flexShrink: 0,
                    borderBottom: '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    display: 'flex', alignItems: 'center', gap: 20 }}>

        {/* Back + Symbol */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigate(-1)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text)', display: 'flex' }}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
            onClick={() => navigate('/markets')}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>{baseSym}</span>
            <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>/USDT</span>
            <ChevronDown size={13} color="var(--color-muted)" />
          </div>
        </div>

        {/* Price */}
        <div style={{ fontSize: 22, fontWeight: 800,
                      color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {currentPrice > 0 ? currentPrice.toLocaleString(undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '---'}
        </div>

        <div style={{ width: 1, height: 28, background: 'var(--color-border)' }} />

        {/* Stats */}
        {[
          { label: '24h Change', val: `${isUp?'+':''}${change24h.toFixed(2)}%`,
            color: isUp ? 'var(--color-success)' : 'var(--color-danger)' },
          { label: '24h High', val: high24h > 0 ? high24h.toFixed(4) : '---',
            color: 'var(--color-success)' },
          { label: '24h Low',  val: low24h > 0 ? low24h.toFixed(4) : '---',
            color: 'var(--color-danger)' },
          { label: '24h Vol',  val: volume24h > 1e6
            ? `${(volume24h/1e6).toFixed(2)}M`
            : volume24h > 1e3
            ? `${(volume24h/1e3).toFixed(2)}K`
            : volume24h.toFixed(2),
            color: 'var(--color-text)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color }}>{val}</span>
          </div>
        ))}

        <div style={{ flex: 1 }} />

        {/* Quick Trade button */}
        <button onClick={() => setShowOrder(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: 'var(--color-success)', color: '#fff',
          fontWeight: 700, cursor: 'pointer', fontSize: 13
        }}>
          <Plus size={15} /> Quick Trade
        </button>

        {/* Go to full Trade page */}
        <button onClick={() => navigate(`/trade/${sym}`)} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: 'var(--color-primary)', color: '#000',
          fontWeight: 700, cursor: 'pointer', fontSize: 13
        }}>Trade →</button>

        <Star size={18} fill={starred ? '#f0b90b' : 'none'}
          color={starred ? '#f0b90b' : 'var(--color-muted)'}
          style={{ cursor: 'pointer' }} onClick={() => setStarred(!starred)} />
        <RefreshCw size={16} color="var(--color-muted)"
          style={{ cursor: 'pointer' }}
          onClick={() => setRefreshKey(k => k + 1)} />
      </div>

      {/* Full width Chart */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', minHeight: 0 }}>
        <CandleChart sym={sym} currentPrice={currentPrice} />
      </div>

      {/* Bottom Tabs — full width */}
      <div style={{ height: 180, borderTop: '1px solid var(--color-border)',
                    flexShrink: 0, display: 'flex', flexDirection: 'column',
                    overflow: 'hidden' }}>
        <ChartBottomTabs
          bottomTab={bottomTab} baseSym={baseSym} sym={sym}
          currentPrice={currentPrice} change24h={change24h} isUp={isUp}
          high24h={high24h} low24h={low24h} volume24h={volume24h}
          orderBook={orderBook} tradesList={tradesList}
          onTabChange={setBottomTab}
        />
      </div>

      {/* Quick Order Sheet (bottom popup) */}
      {showOrder && (
        <QuickOrderSheet
          sym={sym} baseSym={baseSym} currentPrice={currentPrice}
          onClose={() => setShowOrder(false)}
          onSuccess={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
}
