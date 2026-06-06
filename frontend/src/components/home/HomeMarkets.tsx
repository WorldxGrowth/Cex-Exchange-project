import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

type TabType = 'hot' | 'gainers' | 'losers' | 'new';

// Countdown for scheduled tokens
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

function ScheduledPairRow({ pair }: { pair: any }) {
  const navigate  = useNavigate();
  const countdown = useCountdown(pair.listing_date);
  return (
    <div onClick={() => navigate(`/listing/${pair.symbol}`)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
               padding: '12px 0', borderBottom: '1px solid var(--color-border)',
               cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {pair.base_logo
          ? <img src={pair.base_logo} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }}
              onError={(e) => { (e.target as any).style.display='none'; }} />
          : <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                          background: 'var(--color-surface)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, color: 'var(--color-primary)', fontSize: 14 }}>
              {pair.base_symbol?.charAt(0)}
            </div>
        }
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
            {pair.base_symbol}
            <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: 12 }}>/USDT</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-primary)', marginTop: 2, fontWeight: 600 }}>
            New Listing
          </div>
        </div>
      </div>
      <div style={{ background: 'var(--color-surface)', borderRadius: 8,
                    padding: '4px 8px', fontSize: 11, fontWeight: 600,
                    color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}>
        {countdown}
      </div>
    </div>
  );
}

interface Props {
  pairs: any[];
  prices: any;
}

const tabs = [
  { key: 'hot',     label: 'Popular' },
  { key: 'gainers', label: 'Gainers' },
  { key: 'losers',  label: 'Losers'  },
  { key: 'new',     label: 'New'     },
] as const;

export default function HomeMarkets({ pairs, prices }: Props) {
  const navigate  = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('hot');

  const getFiltered = () => {
    // Hot/Gainers/Losers: only active pairs
    // New: all pairs (active + scheduled)
    const list = activeTab === 'new'
      ? [...pairs]
      : [...pairs].filter(p => p.is_active);

    switch (activeTab) {
      case 'gainers': return list.sort((a, b) =>
        parseFloat(b.change_24h||0) - parseFloat(a.change_24h||0));
      case 'losers':  return list.sort((a, b) =>
        parseFloat(a.change_24h||0) - parseFloat(b.change_24h||0));
      case 'new':
        return list.sort((a, b) => {
          // Scheduled first
          const aS = a.pre_listing_mode ? 1 : 0;
          const bS = b.pre_listing_mode ? 1 : 0;
          if (bS !== aS) return bS - aS;
          return new Date(b.listing_date||b.created_at||0).getTime()
               - new Date(a.listing_date||a.created_at||0).getTime();
        });
      default: return list;
    }
  };

  const filtered = getFiltered().slice(0, 8);

  return (
    <div style={{ padding: '4px 16px 0' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
          Markets
        </span>
        <span onClick={() => navigate('/markets')}
          style={{ fontSize: 13, color: 'var(--color-primary)', cursor: 'pointer',
                   display: 'flex', alignItems: 'center', gap: 2 }}>
          See all <ChevronRight size={14} />
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-surface)',
            color: activeTab === tab.key ? '#000' : 'var(--color-muted)',
            fontSize: 12, fontWeight: activeTab === tab.key ? 700 : 500,
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Skeleton */}
      {pairs.length === 0
        ? Array(5).fill(0).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '12px 0',
                                 borderBottom: '1px solid var(--color-border)', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%',
                          background: 'var(--color-surface)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ width: 80, height: 13, borderRadius: 4,
                            background: 'var(--color-surface)', marginBottom: 5 }} />
              <div style={{ width: 60, height: 11, borderRadius: 4,
                            background: 'var(--color-surface)' }} />
            </div>
            <div style={{ width: 70, height: 13, borderRadius: 4,
                          background: 'var(--color-surface)' }} />
          </div>
        ))
        : filtered.map(pair => {
          // Scheduled token
          if (pair.pre_listing_mode || !pair.is_active) {
            return <ScheduledPairRow key={pair.symbol} pair={pair} />;
          }

          const live   = prices[pair.symbol];
          const price  = live?.price || pair.price;
          const change = parseFloat(live?.change_24h || pair.change_24h || 0);
          const isUp   = change >= 0;

          return (
            <div key={pair.symbol}
              onClick={() => navigate('/trade/' + pair.symbol)}
              style={{ display: 'flex', alignItems: 'center',
                       justifyContent: 'space-between', padding: '12px 0',
                       borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {pair.base_logo
                  ? <img src={pair.base_logo} alt={pair.base_symbol}
                      style={{ width: 40, height: 40, borderRadius: '50%' }}
                      onError={(e) => { (e.target as any).style.display = 'none'; }} />
                  : <div style={{ width: 40, height: 40, borderRadius: '50%',
                                  background: 'var(--color-surface)', display: 'flex',
                                  alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 700, color: 'var(--color-primary)', fontSize: 14 }}>
                      {pair.base_symbol?.charAt(0)}
                    </div>
                }
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                    {pair.base_symbol}
                    <span style={{ color: 'var(--color-muted)', fontWeight: 400,
                                   fontSize: 12 }}>/USDT</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                    Vol ${(parseFloat(pair.volume_24h||0)/1000000).toFixed(1)}M
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                  ${parseFloat(price||0).toLocaleString(undefined,
                    { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                              padding: '3px 8px', borderRadius: 6, marginTop: 3,
                              background: isUp ? '#0ecb8118' : '#f6465d18',
                              color: isUp ? 'var(--color-success)' : 'var(--color-danger)',
                              fontSize: 11, fontWeight: 700 }}>
                  {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {isUp ? '+' : ''}{change.toFixed(2)}%
                </div>
              </div>
            </div>
          );
        })
      }
    </div>
  );
}
