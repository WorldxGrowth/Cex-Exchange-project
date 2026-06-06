import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { marketAPI } from '../../services/api';
import { useStore } from '../../store/useStore';
import { subscribeToTicker } from '../../services/socket';
import { Search } from 'lucide-react';

const SkeletonRow = () => (
  <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px',
                borderBottom: '1px solid var(--color-border)', gap: 10 }}>
    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface)' }} />
    <div style={{ flex: 1 }}>
      <div style={{ width: 80, height: 14, borderRadius: 4, background: 'var(--color-surface)', marginBottom: 6 }} />
      <div style={{ width: 60, height: 11, borderRadius: 4, background: 'var(--color-surface)' }} />
    </div>
    <div style={{ width: 80, height: 14, borderRadius: 4, background: 'var(--color-surface)' }} />
    <div style={{ width: 68, height: 28, borderRadius: 8, background: 'var(--color-surface)' }} />
  </div>
);

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!targetDate) return;
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('00D 00:00:00'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000).toString().padStart(2,'0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2,'0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2,'0');
      setTimeLeft(`${String(d).padStart(2,'0')}D ${h}:${m}:${s}`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [targetDate]);
  return timeLeft;
}

function ScheduledRow({ pair, onClick }: { pair: any; onClick: () => void }) {
  const countdown = useCountdown(pair.listing_date);
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', padding: '13px 16px',
               cursor: 'pointer', borderBottom: '1px solid var(--color-border)',
               background: 'var(--color-bg)', transition: 'background 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg)')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
        {pair.base_logo
          ? <img src={pair.base_logo} alt=""
              style={{ width: 40, height: 40, borderRadius: '50%' }}
              onError={(e) => { (e.target as any).style.display='none'; }} />
          : <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                          background: 'var(--color-surface2)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, color: 'var(--color-primary)', fontSize: 14 }}>
              {pair.base_symbol?.charAt(0)}
            </div>
        }
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
            <span style={{ fontWeight: 800 }}>{pair.base_symbol}</span>
            <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: 12 }}>/USDT</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-primary)', marginTop: 2, fontWeight: 600 }}>
            New Listing
          </div>
        </div>
      </div>
      <div style={{ background: 'var(--color-surface2)', borderRadius: 8,
                    padding: '6px 10px', fontSize: 12, fontWeight: 600,
                    color: 'var(--color-primary)', letterSpacing: 0.5,
                    border: '1px solid var(--color-border)' }}>
        {countdown}
      </div>
    </div>
  );
}

export default function Markets() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const fromFutures = new URLSearchParams(location.search).get('from') === 'futures';
  const { prices, pairs: cachedPairs, setPairs, pairsLoadedAt } = useStore();
  const [pairs, setPairsLocal] = useState<any[]>(cachedPairs || []);
  const [search, setSearch]    = useState('');
  const [tab, setTab]          = useState<'spot'|'gainers'|'losers'|'new'>('spot');
  const [loading, setLoading]  = useState(cachedPairs.length === 0);

  useEffect(() => {
    const cacheAge = Date.now() - pairsLoadedAt;
    const useCache = cachedPairs.length > 0 && cacheAge < 60000;
    if (useCache) {
      setPairsLocal(cachedPairs);
      setLoading(false);
      cachedPairs.forEach((p: any) => subscribeToTicker(p.symbol));
    } else {
      marketAPI.getPairs().then((res: any) => {
        setPairsLocal(res.data);
        setPairs(res.data);
        res.data.forEach((p: any) => subscribeToTicker(p.symbol));
        setLoading(false);
      });
    }
  }, []);

  const filtered = pairs
    .filter(p => {
      if (search) {
        const s = search.toLowerCase();
        if (!p.symbol.toLowerCase().includes(s) &&
            !p.base_symbol?.toLowerCase().includes(s)) return false;
      }
      // New tab: sab dikhao (active + scheduled)
      if (tab === 'new') return true;
      // Baaki tabs: sirf active pairs
      return p.is_active;
    })
    .sort((a, b) => {
      if (tab === 'gainers') return parseFloat(b.change_24h||0) - parseFloat(a.change_24h||0);
      if (tab === 'losers')  return parseFloat(a.change_24h||0) - parseFloat(b.change_24h||0);
      if (tab === 'new') {
        // Scheduled pehle upar
        const aS = a.pre_listing_mode ? 1 : 0;
        const bS = b.pre_listing_mode ? 1 : 0;
        if (bS !== aS) return bS - aS;
        // Phir listing_date descending (latest first)
        const aDate = new Date(a.listing_date || a.created_at || 0).getTime();
        const bDate = new Date(b.listing_date || b.created_at || 0).getTime();
        return bDate - aDate;
      }
      return (a.sort_order||0) - (b.sort_order||0);
    });

  const tabs = [
    { key: 'spot',    label: 'Spot'    },
    { key: 'gainers', label: 'Gainers' },
    { key: 'losers',  label: 'Losers'  },
    { key: 'new',     label: 'New'     },
  ] as const;

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>

      {/* Search */}
      <div style={{ padding: '12px 16px', background: 'var(--color-bg)',
                    borderBottom: '1px solid var(--color-border)',
                    position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--color-surface)', borderRadius: 24,
                      padding: '10px 16px', border: '1px solid var(--color-border)' }}>
          <Search size={15} color="var(--color-muted)" />
          <input placeholder="Search coin..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none',
                     color: 'var(--color-text)', fontSize: 14, outline: 'none' }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--color-bg)',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '0 8px', overflowX: 'auto', scrollbarWidth: 'none',
                    position: 'sticky', top: 57, zIndex: 9 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '13px 16px', background: 'none', border: 'none',
            cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 15,
            fontWeight: tab === t.key ? 700 : 500,
            color: tab === t.key ? 'var(--color-text)' : 'var(--color-muted)',
            borderBottom: tab === t.key
              ? '2px solid var(--color-primary)' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Column headers */}
      <div style={{ display: 'flex', padding: '8px 16px', background: 'var(--color-bg)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--color-muted)', fontWeight: 500 }}>
          Market/Vol
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 500,
                       width: tab === 'new' ? 'auto' : 110, textAlign: 'right' }}>
          {tab === 'new' ? 'Listing / Countdown' : 'Price'}
        </span>
        {tab !== 'new' && (
          <span style={{ width: 80, textAlign: 'right', fontSize: 12,
                         color: 'var(--color-muted)', fontWeight: 500 }}>Change</span>
        )}
      </div>

      {/* List */}
      {loading ? <SkeletonRow /> : filtered.map(pair => {
        // Scheduled token row
        if (pair.pre_listing_mode || !pair.is_active) {
          return (
            <ScheduledRow key={pair.symbol} pair={pair}
              onClick={() => navigate(`/listing/${pair.symbol}`)} />
          );
        }

        // Normal trading pair
        const live   = prices[pair.symbol];
        const price  = live?.price || pair.price || '0';
        const change = parseFloat(live?.change_24h || pair.change_24h || '0');
        const isUp   = change >= 0;

        // New tab mein active pairs → show price+change
        return (
          <div key={pair.symbol}
            onClick={() => navigate(fromFutures ? `/futures/${pair.symbol}` : `/trade/${pair.symbol}`)}
            style={{ display: 'flex', alignItems: 'center', padding: '13px 16px',
                     cursor: 'pointer', borderBottom: '1px solid var(--color-border)',
                     background: 'var(--color-bg)', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg)')}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              {pair.base_logo
                ? <img src={pair.base_logo} alt=""
                    style={{ width: 40, height: 40, borderRadius: '50%' }}
                    onError={(e) => { (e.target as any).style.display='none'; }} />
                : <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                                background: 'var(--color-surface2)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, color: 'var(--color-primary)', fontSize: 14 }}>
                    {pair.base_symbol?.charAt(0)}
                  </div>
              }
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
                  <span style={{ fontWeight: 800 }}>{pair.base_symbol}</span>
                  <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: 12 }}>/USDT</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                  Vol {(parseFloat(pair.volume_24h||0)/1e6) >= 1
                    ? `${(parseFloat(pair.volume_24h||0)/1e6).toFixed(2)}M`
                    : `${(parseFloat(pair.volume_24h||0)/1e3).toFixed(1)}K`}
                </div>
              </div>
            </div>

            <div style={{ width: 110, textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
                {parseFloat(String(price)||'0').toLocaleString(undefined,
                  { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 1 }}>
                ${parseFloat(String(price)||'0').toLocaleString(undefined,
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ width: 80, textAlign: 'right' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center',
                            justifyContent: 'center', padding: '6px 8px', borderRadius: 8,
                            background: isUp ? '#0ecb81' : '#f6465d',
                            color: '#fff', fontSize: 12, fontWeight: 700, minWidth: 68 }}>
                {isUp ? '+' : ''}{change.toFixed(2)}%
              </div>
            </div>
          </div>
        );
      })}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px',
                      color: 'var(--color-muted)', fontSize: 14 }}>
          {tab === 'new' ? 'No listings' : `No results for "${search}"`}
        </div>
      )}
    </div>
  );
}
