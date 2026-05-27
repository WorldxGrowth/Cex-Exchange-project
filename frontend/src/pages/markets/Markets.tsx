import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { marketAPI } from '../../services/api';
import { useStore } from '../../store/useStore';
import { subscribeToTicker } from '../../services/socket';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';

// Skeleton row
const SkeletonRow = () => (
  <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--color-border)', gap: 10 }}>
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-surface2)' }} />
    <div style={{ flex: 1 }}>
      <div style={{ width: 80, height: 14, borderRadius: 4, background: 'var(--color-surface2)', marginBottom: 6 }} />
      <div style={{ width: 60, height: 11, borderRadius: 4, background: 'var(--color-surface2)' }} />
    </div>
    <div style={{ width: 80, height: 14, borderRadius: 4, background: 'var(--color-surface2)' }} />
    <div style={{ width: 60, height: 24, borderRadius: 6, background: 'var(--color-surface2)' }} />
  </div>
);

export default function Markets() {
  const navigate = useNavigate();
  const { prices, pairs: cachedPairs, setPairs, pairsLoadedAt } = useStore();
  const [pairs, setPairsLocal] = useState<any[]>(cachedPairs || []);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all'|'gainers'|'losers'|'new'>('all');
  const [loading, setLoading] = useState(cachedPairs.length === 0);

  useEffect(() => {
    // Cache valid hai (60 sec) to fresh call mat karo
    const cacheAge = Date.now() - pairsLoadedAt;
    const useCache = cachedPairs.length > 0 && cacheAge < 60000;

    if (useCache) {
      setPairsLocal(cachedPairs);
      setLoading(false);
      // Background mein bhi subscribe karo
      cachedPairs.forEach((p: any) => subscribeToTicker(p.symbol));
    } else {
      marketAPI.getPairs().then((res: any) => {
        setPairsLocal(res.data);
        setPairs(res.data); // Cache mein save
        res.data.forEach((p: any) => subscribeToTicker(p.symbol));
        setLoading(false);
      });
    }
  }, []);

  const filtered = pairs.filter(p => {
    if (search && !p.symbol.toLowerCase().includes(search.toLowerCase()) &&
        !p.base_symbol?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (tab === 'gainers') return parseFloat(b.change_24h||0) - parseFloat(a.change_24h||0);
    if (tab === 'losers')  return parseFloat(a.change_24h||0) - parseFloat(b.change_24h||0);
    return a.sort_order - b.sort_order;
  });

  return (
    <div>
      {/* Search */}
      <div style={{ padding: '12px 16px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
          <input placeholder="Search coin..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 24,
                     border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
                     color: 'var(--color-text)', fontSize: 14, outline: 'none' }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)', padding: '0 8px' }}>
        {(['all','gainers','losers','new'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t ? 'var(--color-primary)' : 'var(--color-muted)',
            borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
            fontSize: 14, fontWeight: tab === t ? 600 : 400, textTransform: 'capitalize'
          }}>
            {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', padding: '8px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--color-muted)' }}>Coin / Vol</span>
        <span style={{ width: 110, textAlign: 'right', fontSize: 12, color: 'var(--color-muted)' }}>Last Price</span>
        <span style={{ width: 75, textAlign: 'right', fontSize: 12, color: 'var(--color-muted)' }}>24h</span>
      </div>

      {/* List */}
      {loading
        ? Array(8).fill(0).map((_, i) => <SkeletonRow key={i} />)
        : filtered.map(pair => {
          const live = prices[pair.symbol];
          const price = live?.price || pair.price;
          const change = parseFloat(live?.change_24h || pair.change_24h || 0);
          const isUp = change >= 0;

          return (
            <div key={pair.symbol} onClick={() => navigate(`/trade/${pair.symbol}`)}
              style={{ display: 'flex', alignItems: 'center', padding: '11px 16px',
                       cursor: 'pointer', borderBottom: '1px solid var(--color-border)',
                       transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Icon */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                {pair.base_logo
                  ? <img src={pair.base_logo} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }}
                      onError={(e) => { (e.target as any).style.display='none'; }} />
                  : <div style={{ width: 36, height: 36, borderRadius: '50%',
                                  background: 'var(--color-surface2)', display: 'flex',
                                  alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 700, color: 'var(--color-primary)', fontSize: 13 }}>
                      {pair.base_symbol?.charAt(0)}
                    </div>
                }
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                    {pair.base_symbol}
                    <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: 12 }}>/USDT</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 1 }}>
                    Vol ${(parseFloat(pair.volume_24h||0)/1000000).toFixed(1)}M
                  </div>
                </div>
              </div>

              {/* Price */}
              <div style={{ width: 110, textAlign: 'right', fontWeight: 600,
                            fontSize: 14, color: 'var(--color-text)' }}>
                ${parseFloat(price||0).toLocaleString(undefined,
                  { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </div>

              {/* Change badge */}
              <div style={{ width: 75, textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block', padding: '3px 7px', borderRadius: 5,
                  background: isUp ? '#0ecb8118' : '#f6465d18',
                  color: isUp ? 'var(--color-success)' : 'var(--color-danger)',
                  fontSize: 12, fontWeight: 600
                }}>
                  {isUp ? '+' : ''}{change.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })
      }
    </div>
  );
}
