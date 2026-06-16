import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI } from '../../services/api';
import {
  ArrowDownLeft, ArrowUpRight, Repeat, Eye, EyeOff,
  History, Search, Wallet, ChevronRight
} from 'lucide-react';

type TabType = 'overview' | 'spot' | 'futures' | 'funding' | 'earn';

function useIsDesktop() {
  const [d, setD] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const h = () => setD(window.innerWidth >= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return d;
}

export default function Assets() {
  const navigate  = useNavigate();
  const desktop   = useIsDesktop();
  const [allBalances, setAllBalances] = useState<any[]>([]);
  const [totalUsdt, setTotalUsdt]     = useState('0.00');
  const [hideBalance, setHideBalance] = useState(false);
  const [activeTab, setActiveTab]     = useState<TabType>('overview');
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [hideSmall, setHideSmall]     = useState(false);

  useEffect(() => {
    walletAPI.getBalances().then((res: any) => {
      setAllBalances(res.data.balances || []);
      setTotalUsdt(parseFloat(res.data.total_usdt || 0).toFixed(2));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const byType = (type: string) =>
    allBalances.filter((b: any) => b.account_type === type);

  const totalByType = (type: string) =>
    byType(type).reduce((sum: number, b: any) =>
      sum + parseFloat(b.total_usdt_value || 0), 0).toFixed(2);

  const mask = (val: string) => hideBalance ? '••••••' : val;

  const filteredByType = (type: string) => {
    let list = byType(type);
    if (hideSmall) list = list.filter((b: any) =>
      parseFloat(b.total_usdt_value || 0) >= 1);
    return list.filter((b: any) =>
      !search ||
      b.symbol?.toLowerCase().includes(search.toLowerCase()) ||
      b.name?.toLowerCase().includes(search.toLowerCase())
    );
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'spot',     label: 'Spot' },
    { key: 'futures',  label: 'Futures' },
    { key: 'funding',  label: 'Funding' },
    { key: 'earn',     label: 'Earn' },
  ];

  const tabLabel: any = {
    overview: 'Total',
    spot:     'Est. balance',
    futures:  'Margin balance',
    funding:  'Funding balance',
    earn:     'Earn balance'
  };

  const actions = [
    { icon: ArrowDownLeft, label: 'Deposit',  path: '/deposit',         color: '#0ecb81' },
    { icon: ArrowUpRight,  label: 'Withdraw', path: '/withdraw',        color: '#f6465d' },
    { icon: Repeat,        label: 'Transfer', path: '/transfer',        color: '#1890ff' },
    { icon: History,       label: 'History',  path: '/deposit-history', color: '#f0b90b' },
  ];

  const currentBal = activeTab === 'overview'
    ? parseFloat(totalUsdt)
    : parseFloat(totalByType(activeTab));

  // ── Balance Header (shared) ──────────────────
  const BalanceHeader = () => (
    <div style={{ padding: desktop ? '24px 24px 20px' : '24px 20px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
        <span>{tabLabel[activeTab]}</span>
        <button onClick={() => setHideBalance(!hideBalance)}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
                   color: 'var(--color-muted)', display: 'flex' }}>
          {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: desktop ? 40 : 34, fontWeight: 800,
                       color: 'var(--color-text)', letterSpacing: -1 }}>
          {mask(currentBal.toLocaleString(undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
        </span>
        <span style={{ fontSize: 15, color: 'var(--color-muted)' }}>USDT</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 8 }}>
        ≈ ${mask(currentBal.toLocaleString(undefined,
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                    marginBottom: 24, fontSize: 13 }}>
        <span style={{ color: 'var(--color-muted)' }}>Today's PnL:</span>
        <span style={{ color: 'var(--color-muted)', fontWeight: 600 }}>$0.00 (0.00%)</span>
        <ChevronRight size={14} color="var(--color-muted)" />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {actions.map(({ icon: Icon, label, path, color }) => (
          <button key={label} onClick={() => navigate(path)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
          }}>
            <div style={{
              width: desktop ? 56 : 52, height: desktop ? 56 : 52, borderRadius: '50%',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              <Icon size={20} color={color} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--color-text)', fontWeight: 500 }}>
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* VIP banner */}
      <div onClick={() => alert('Coming soon')}
        style={{ marginTop: 20, padding: '12px 16px', borderRadius: 12,
                 background: 'var(--color-surface)',
                 border: '1px solid var(--color-border)',
                 display: 'flex', alignItems: 'center',
                 justifyContent: 'space-between', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%',
                        background: '#f0b90b20',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={16} color="#f0b90b" />
          </div>
          <span style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500 }}>
            Upgrade to VIP and enjoy more perks
          </span>
        </div>
        <ChevronRight size={16} color="var(--color-muted)" />
      </div>
    </div>
  );

  // ── Overview content ─────────────────────────
  const OverviewContent = () => (
    <div style={{ padding: desktop ? '8px 24px' : '8px 20px' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)',
                    marginBottom: 4, paddingBottom: 10,
                    borderBottom: '2px solid var(--color-primary)',
                    display: 'inline-block' }}>
        Account
      </div>
      {[
        { type: 'spot',    label: 'Spot' },
        { type: 'futures', label: 'Futures' },
        { type: 'funding', label: 'Funding' },
        { type: 'earn',    label: 'Earn' },
      ].map(({ type, label }) => (
        <div key={type} onClick={() => setActiveTab(type as TabType)}
          style={{ display: 'flex', justifyContent: 'space-between',
                   alignItems: 'center', padding: '16px 0',
                   borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}>
          <span style={{ fontSize: 16, color: 'var(--color-text)', fontWeight: 500 }}>
            {label}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                {mask(parseFloat(totalByType(type)).toLocaleString(undefined,
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 }))} USDT
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                ${mask(parseFloat(totalByType(type)).toLocaleString(undefined,
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
              </div>
            </div>
            <ChevronRight size={16} color="var(--color-muted)" />
          </div>
        </div>
      ))}
    </div>
  );

  // ── Token list content ───────────────────────
  const TokenContent = () => (
    <div>
      {/* Search + hide small */}
      <div style={{ padding: desktop ? '12px 24px' : '12px 16px',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, position: 'relative', maxWidth: desktop ? 360 : '100%' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
            transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
          <input placeholder="Search coin..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 10px 9px 32px',
                     borderRadius: 20, border: '1px solid var(--color-border)',
                     background: 'var(--color-surface)',
                     color: 'var(--color-text)', fontSize: 13,
                     outline: 'none', boxSizing: 'border-box' as const }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div onClick={() => setHideSmall(!hideSmall)}
            style={{ width: 16, height: 16, borderRadius: 3,
                     border: `2px solid ${hideSmall ? 'var(--color-primary)' : 'var(--color-border)'}`,
                     background: hideSmall ? 'var(--color-primary)' : 'transparent',
                     cursor: 'pointer', display: 'flex', alignItems: 'center',
                     justifyContent: 'center', flexShrink: 0 }}>
            {hideSmall && <span style={{ fontSize: 9, color: '#000', fontWeight: 900 }}>✓</span>}
          </div>
          <span style={{ fontSize: 13, color: 'var(--color-muted)', cursor: 'pointer',
                         whiteSpace: 'nowrap' }}
            onClick={() => setHideSmall(!hideSmall)}>
            Hide &lt; 1 USDT
          </span>
        </div>
      </div>

      {/* Desktop: table header */}
      {desktop && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
                      padding: '10px 24px', borderBottom: '1px solid var(--color-border)',
                      background: 'var(--color-surface)' }}>
          {['Coin', 'Available', 'Locked', 'USD Value', '24h Change'].map(h => (
            <span key={h} style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600,
                                   textAlign: h === 'Coin' ? 'left' : 'right' }}>{h}</span>
          ))}
        </div>
      )}

      {/* Asset rows */}
      <div style={{ padding: desktop ? '0 24px' : '0 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>
            Loading...
          </div>
        ) : filteredByType(activeTab).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%',
                          background: 'var(--color-surface)',
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'center', margin: '0 auto 16px' }}>
              <Wallet size={28} color="var(--color-muted)" />
            </div>
            <div style={{ color: 'var(--color-muted)', fontSize: 14, marginBottom: 16 }}>
              No assets in {activeTab}
            </div>
            {activeTab === 'spot' && (
              <button onClick={() => navigate('/deposit')} style={{
                padding: '12px 28px', borderRadius: 12,
                background: 'var(--color-primary)', border: 'none',
                color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 14
              }}>Deposit Now</button>
            )}
          </div>
        ) : filteredByType(activeTab).map((b: any) => {
          const change = parseFloat(b.change_24h || 0);
          const isUp   = change >= 0;

          // Desktop: table row
          if (desktop) {
            return (
              <div key={b.symbol + b.account_type}
                onClick={() => navigate(`/token/${b.symbol}`)}
                style={{ display: 'grid',
                         gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
                         padding: '14px 0', cursor: 'pointer',
                         borderBottom: '1px solid var(--color-border)',
                         alignItems: 'center', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                {/* Coin */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {b.logo_url
                    ? <img src={b.logo_url} alt=""
                        style={{ width: 36, height: 36, borderRadius: '50%' }}
                        onError={(e) => { (e.target as any).style.display = 'none'; }} />
                    : <div style={{ width: 36, height: 36, borderRadius: '50%',
                                    background: 'var(--color-surface)',
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontWeight: 800,
                                    color: 'var(--color-primary)', fontSize: 13 }}>
                        {b.symbol?.charAt(0)}
                      </div>
                  }
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{b.symbol}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{b.name || ''}</div>
                  </div>
                </div>

                {/* Available */}
                <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 14 }}>
                  {mask(parseFloat(b.available || 0).toFixed(6))}
                </div>

                {/* Locked */}
                <div style={{ textAlign: 'right', fontSize: 14,
                              color: parseFloat(b.locked || 0) > 0
                                ? 'var(--color-warning)' : 'var(--color-muted)' }}>
                  {mask(parseFloat(b.locked || 0).toFixed(6))}
                </div>

                {/* USD Value */}
                <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 600 }}>
                  ${mask(parseFloat(b.total_usdt_value || 0).toFixed(2))}
                </div>

                {/* 24h Change */}
                <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 600,
                              color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {isUp ? '+' : ''}{change.toFixed(2)}%
                </div>
              </div>
            );
          }

          // Mobile: card row (same as before)
          return (
            <div key={b.symbol + b.account_type}
              onClick={() => navigate(`/token/${b.symbol}`)}
              style={{ display: 'flex', alignItems: 'center',
                       justifyContent: 'space-between', padding: '14px 0',
                       cursor: 'pointer',
                       borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {b.logo_url
                  ? <img src={b.logo_url} alt=""
                      style={{ width: 40, height: 40, borderRadius: '50%' }}
                      onError={(e) => { (e.target as any).style.display = 'none'; }} />
                  : <div style={{ width: 40, height: 40, borderRadius: '50%',
                                  background: 'var(--color-surface)',
                                  display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', fontWeight: 800,
                                  color: 'var(--color-primary)', fontSize: 14 }}>
                      {b.symbol?.charAt(0)}
                    </div>
                }
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{b.symbol}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                    Today's PnL{' '}
                    <span style={{ color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {isUp ? '+' : ''}{change.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {mask(parseFloat(b.available || 0).toFixed(6))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                  ≈${mask(parseFloat(b.total_usdt_value || 0).toFixed(2))}
                </div>
                {parseFloat(b.locked || 0) > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 2 }}>
                    Locked: {parseFloat(b.locked).toFixed(6)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── MOBILE LAYOUT ──────────────────────────────
  if (!desktop) {
    return (
      <div style={{ background: 'var(--color-bg)', minHeight: '100vh',
                    paddingBottom: 80 }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 10,
                      background: 'var(--color-bg)',
                      borderBottom: '1px solid var(--color-border)',
                      display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' as const }}>
          {tabs.map(tab => (
            <button key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(''); }}
              style={{ padding: '14px 18px', background: 'none', border: 'none',
                       cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 15, fontWeight: 700,
                       color: activeTab === tab.key ? 'var(--color-text)' : 'var(--color-muted)',
                       borderBottom: activeTab === tab.key
                         ? '2px solid var(--color-primary)' : '2px solid transparent' }}>
              {tab.label}
            </button>
          ))}
        </div>
        <BalanceHeader />
        {activeTab === 'overview' ? <OverviewContent /> : <TokenContent />}
      </div>
    );
  }

  // ── DESKTOP LAYOUT ────────────────────────────
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>

      {/* Tabs */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10,
                    background: 'var(--color-bg)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex', padding: '0 24px' }}>
        {tabs.map(tab => (
          <button key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearch(''); }}
            style={{ padding: '14px 20px', background: 'none', border: 'none',
                     cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 15, fontWeight: 700,
                     color: activeTab === tab.key ? 'var(--color-text)' : 'var(--color-muted)',
                     borderBottom: activeTab === tab.key
                       ? '2px solid var(--color-primary)' : '2px solid transparent' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 2-col layout */}
      <div style={{ maxWidth: 1280, margin: '0 auto',
                    display: 'flex', gap: 0, alignItems: 'flex-start' }}>

        {/* LEFT: Balance + Actions (fixed width) */}
        <div style={{ width: 360, flexShrink: 0,
                      borderRight: '1px solid var(--color-border)',
                      minHeight: 'calc(100vh - 53px)', position: 'sticky', top: 53 }}>
          <BalanceHeader />
          {activeTab === 'overview' && <OverviewContent />}
        </div>

        {/* RIGHT: Token table */}
        {activeTab !== 'overview' && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <TokenContent />
          </div>
        )}

        {/* Overview: right side summary */}
        {activeTab === 'overview' && (
          <div style={{ flex: 1, padding: '24px', minWidth: 0 }}>
            <div style={{ background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px',
                            borderBottom: '1px solid var(--color-border)',
                            fontWeight: 700, fontSize: 16 }}>
                Portfolio Summary
              </div>
              {[
                { type: 'spot',    label: 'Spot',    color: '#0ecb81' },
                { type: 'futures', label: 'Futures', color: '#1890ff' },
                { type: 'funding', label: 'Funding', color: '#f0b90b' },
                { type: 'earn',    label: 'Earn',    color: '#722ed1' },
              ].map(({ type, label, color }) => {
                const val = parseFloat(totalByType(type));
                const total = parseFloat(totalUsdt) || 1;
                const pct = ((val / total) * 100).toFixed(1);
                return (
                  <div key={type} onClick={() => setActiveTab(type as TabType)}
                    style={{ padding: '16px 20px',
                             borderBottom: '1px solid var(--color-border)',
                             cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                                  marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%',
                                      background: color }} />
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>
                          {mask(val.toLocaleString(undefined,
                            { minimumFractionDigits: 2, maximumFractionDigits: 2 }))} USDT
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--color-muted)',
                                       marginLeft: 8 }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 4, borderRadius: 2,
                                  background: 'var(--color-border)' }}>
                      <div style={{ height: '100%', borderRadius: 2,
                                    background: color,
                                    width: `${pct}%`,
                                    transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
