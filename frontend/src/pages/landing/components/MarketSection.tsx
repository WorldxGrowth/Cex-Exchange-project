import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, ChevronRight, Flame, ArrowUpRight, ArrowDownRight, Star } from 'lucide-react';

interface Props {
  pairs: any[];
  prices: Record<string, any>;
}

export default function MarketSection({ pairs, prices }: Props) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'hot'|'gainers'|'losers'|'new'>('hot');

  const getFiltered = () => {
    if (!pairs.length) return [];
    const withPrice = pairs.filter(p => p.is_active).map(p => ({
      ...p,
      livePrice: prices[p.symbol]?.price || p.last_price || 0,
      change: parseFloat(prices[p.symbol]?.change_24h || p.change_24h || 0),
    }));
    if (activeTab === 'gainers') return [...withPrice].sort((a, b) => b.change - a.change).slice(0, 8);
    if (activeTab === 'losers')  return [...withPrice].sort((a, b) => a.change - b.change).slice(0, 8);
    if (activeTab === 'new')     return [...withPrice].slice(-8).reverse();
    return withPrice.slice(0, 8);
  };

  const tabs = [
    { key: 'hot',     label: 'Hot',     icon: Flame },
    { key: 'gainers', label: 'Gainers', icon: ArrowUpRight },
    { key: 'losers',  label: 'Losers',  icon: ArrowDownRight },
    { key: 'new',     label: 'New',     icon: Star },
  ] as const;

  return (
    <section style={{ padding: '64px 20px', background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
            Live Markets
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: 15 }}>
            Real-time prices updated every second
          </p>
        </div>

        {/* Tabs - single row, no wrap */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20,
                      background: 'var(--color-surface)',
                      borderRadius: 12, padding: 4,
                      border: '1px solid var(--color-border)',
                      width: '100%', boxSizing: 'border-box' }}>
          {tabs.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <button key={key} onClick={() => setActiveTab(key)} style={{
                flex: 1, padding: '9px 8px', borderRadius: 9, border: 'none',
                background: isActive ? 'var(--color-primary)' : 'none',
                color: isActive ? '#000' : 'var(--color-muted)',
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 5
              }}>
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ background: 'var(--color-surface)',
                      borderRadius: 16, border: '1px solid var(--color-border)',
                      overflow: 'hidden' }}>

          {/* Table header */}
          <div style={{ display: 'grid',
                        gridTemplateColumns: '2fr 1.2fr 1fr 80px',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--color-border)',
                        color: 'var(--color-muted)', fontSize: 12, fontWeight: 600 }}>
            <span>Pair</span>
            <span style={{ textAlign: 'right' }}>Price</span>
            <span style={{ textAlign: 'right' }}>24h</span>
            <span style={{ textAlign: 'right' }}>Trade</span>
          </div>

          {getFiltered().length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center',
                          color: 'var(--color-muted)', fontSize: 14 }}>
              Loading markets...
            </div>
          ) : getFiltered().map((pair: any) => {
            const isUp = pair.change >= 0;
            return (
              <div key={pair.symbol}
                onClick={() => navigate('/login')}
                style={{ display: 'grid',
                         gridTemplateColumns: '2fr 1.2fr 1fr 80px',
                         padding: '12px 16px',
                         borderBottom: '1px solid var(--color-border)',
                         cursor: 'pointer', transition: 'background 0.15s',
                         alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                {/* Coin */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img
                    src={pair.base_logo || `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${pair.base_symbol?.toLowerCase()}.svg`}
                    width={32} height={32} style={{ borderRadius: '50%', flexShrink: 0 }}
                    onError={(e: any) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${pair.base_symbol}&size=32&background=f0b90b&color=000`;
                    }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
                      {pair.base_symbol}
                      <span style={{ color: 'var(--color-muted)', fontWeight: 400,
                                     fontSize: 11 }}>/USDT</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 1 }}>
                      Vol {(parseFloat(pair.volume_24h||0)/1e6).toFixed(1)}M
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                  ${parseFloat(pair.livePrice||0).toLocaleString(undefined,
                    { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </div>

                {/* Change */}
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13,
                              color: isUp ? 'var(--color-success)' : 'var(--color-danger)',
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'flex-end', gap: 3 }}>
                  {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {isUp ? '+' : ''}{pair.change.toFixed(2)}%
                </div>

                {/* Button */}
                <div style={{ textAlign: 'right' }}>
                  <button onClick={e => { e.stopPropagation(); navigate('/login'); }}
                    style={{ padding: '5px 12px', borderRadius: 8, border: 'none',
                             background: 'var(--color-primary)', color: '#000',
                             fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Trade
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* View All */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={() => navigate('/login')} style={{
            padding: '11px 28px', borderRadius: 10,
            background: 'none', border: '1px solid var(--color-border)',
            color: 'var(--color-text)', fontSize: 14, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6
          }}>
            View All Markets <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
