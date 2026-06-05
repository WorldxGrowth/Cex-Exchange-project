import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { marketAPI } from '../../services/api';
import { Plus } from 'lucide-react';

import ChartHeader from '../../components/chart/ChartHeader';
import CandleChart from '../../components/chart/CandleChart';
import ChartBottomTabs from '../../components/chart/ChartBottomTabs';
import QuickOrderSheet from '../../components/chart/QuickOrderSheet';

export default function Chart() {
  const { symbol = 'BTCUSDT' } = useParams();
  const { prices } = useStore();

  const [ticker, setTicker]       = useState<any>(null);
  const [orderBook, setOrderBook] = useState<any>({ bids: [], asks: [] });
  const [tradesList, setTradesList] = useState<any[]>([]);
  const [bottomTab, setBottomTab] = useState<'book'|'trades'|'info'>('book');
  const [starred, setStarred]     = useState(false);
  const [showOrder, setShowOrder] = useState(false);
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

      {/* Bottom action bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8,
                    padding: '10px 12px', borderTop: '1px solid var(--color-border)',
                    flexShrink: 0, background: 'var(--color-bg)' }}>
        <button onClick={() => setShowOrder(true)} style={{
          padding: '13px', borderRadius: 24, background: 'var(--color-primary)',
          border: 'none', color: '#000', fontWeight: 700,
          cursor: 'pointer', fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
        }}>
          <Plus size={18} />Trade
        </button>
        <button style={{ padding: '13px 16px', borderRadius: 12,
                         background: 'var(--color-surface)',
                         border: 'none', color: 'var(--color-text)',
                         cursor: 'pointer', fontSize: 13 }}>Futures</button>
        <button style={{ padding: '13px 16px', borderRadius: 12,
                         background: 'var(--color-surface)',
                         border: 'none', color: 'var(--color-text)',
                         cursor: 'pointer', fontSize: 13 }}>More</button>
      </div>

      {/* Quick Order Bottom Sheet */}
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
