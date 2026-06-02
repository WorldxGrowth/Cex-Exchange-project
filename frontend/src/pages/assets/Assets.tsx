import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI } from '../../services/api';
import {
  ArrowDownLeft, ArrowUpRight, Repeat, Eye, EyeOff,
  History, Search, Wallet, ChevronRight, TrendingDown, TrendingUp
} from 'lucide-react';

type TabType = 'overview' | 'spot' | 'futures' | 'funding' | 'earn';

export default function Assets() {
  const navigate  = useNavigate();
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

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh',
                  paddingBottom: 80, display: 'flex', flexDirection: 'column' }}>

      {/* ── STICKY TABS ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {tabs.map(tab => (
          <button key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearch(''); }}
            style={{
              padding: '14px 18px', background: 'none', border: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 15, fontWeight: 700,
              color: activeTab === tab.key ? 'var(--color-text)' : 'var(--color-muted)',
              borderBottom: activeTab === tab.key
                ? '2px solid var(--color-primary)' : '2px solid transparent',
              transition: 'color 0.2s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── BALANCE HEADER ── */}
      <div style={{ background: 'var(--color-bg)', padding: '24px 20px 20px' }}>

        {/* Label + eye */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
          <span>{tabLabel[activeTab]}</span>
          <button onClick={() => setHideBalance(!hideBalance)}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
                     color: 'var(--color-muted)', display: 'flex' }}>
            {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {/* Amount */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 34, fontWeight: 800, color: 'var(--color-text)',
                         letterSpacing: -1 }}>
            {mask(currentBal.toLocaleString(undefined,
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
          </span>
          <span style={{ fontSize: 15, color: 'var(--color-muted)' }}>USDT</span>
        </div>

        {/* USD equiv */}
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 8 }}>
          ≈ ${mask(currentBal.toLocaleString(undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
        </div>

        {/* Today PnL placeholder */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                      marginBottom: 24, fontSize: 13 }}>
          <span style={{ color: 'var(--color-muted)' }}>Today's PnL:</span>
          <span style={{ color: 'var(--color-muted)', fontWeight: 600 }}>
            $0.00 (0.00%)
          </span>
          <ChevronRight size={14} color="var(--color-muted)" />
        </div>

        {/* Action Buttons — premium circle style */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {actions.map(({ icon: Icon, label, path, color }) => (
            <button key={label} onClick={() => navigate(path)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
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

        {/* VIP upgrade banner */}
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

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div style={{ padding: '8px 20px' }}>
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
                       borderBottom: '1px solid var(--color-border)',
                       cursor: 'pointer' }}>
              <span style={{ fontSize: 16, color: 'var(--color-text)',
                             fontWeight: 500 }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 700,
                                color: 'var(--color-text)' }}>
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
      )}

      {/* ── SPOT / FUTURES / FUNDING / EARN ── */}
      {activeTab !== 'overview' && (
        <div>
          {/* Search + hide small */}
          <div style={{ padding: '12px 16px',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
              <input placeholder="Search coin..." value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '9px 10px 9px 32px',
                         borderRadius: 20, border: '1px solid var(--color-border)',
                         background: 'var(--color-surface)',
                         color: 'var(--color-text)', fontSize: 13,
                         outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Hide small toggle */}
          <div style={{ padding: '10px 16px',
                        display: 'flex', alignItems: 'center', gap: 8,
                        borderBottom: '1px solid var(--color-border)' }}>
            <div onClick={() => setHideSmall(!hideSmall)}
              style={{ width: 16, height: 16, borderRadius: 3,
                       border: `2px solid ${hideSmall ? 'var(--color-primary)' : 'var(--color-border)'}`,
                       background: hideSmall ? 'var(--color-primary)' : 'transparent',
                       cursor: 'pointer', display: 'flex', alignItems: 'center',
                       justifyContent: 'center', flexShrink: 0 }}>
              {hideSmall && <span style={{ fontSize: 9, color: '#000', fontWeight: 900 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, color: 'var(--color-muted)', cursor: 'pointer' }}
              onClick={() => setHideSmall(!hideSmall)}>
              Hide assets &lt; 1 USDT
            </span>
          </div>

          {/* Assets heading */}
          <div style={{ padding: '14px 16px 6px' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)',
                           paddingBottom: 8,
                           borderBottom: '2px solid var(--color-primary)',
                           display: 'inline-block' }}>
              Assets
            </span>
          </div>

          {/* Token list */}
          <div style={{ padding: '0 16px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40,
                            color: 'var(--color-muted)' }}>Loading...</div>
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
              return (
                <div key={b.symbol + b.account_type}
                  style={{ display: 'flex', alignItems: 'center',
                           justifyContent: 'space-between', padding: '14px 0',
                           borderBottom: '1px solid var(--color-border)' }}>

                  {/* Left: logo + name */}
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
                      <div style={{ fontWeight: 700, fontSize: 15,
                                    color: 'var(--color-text)' }}>{b.symbol}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-muted)',
                                    marginTop: 2 }}>
                        Today's PnL{' '}
                        <span style={{ color: isUp
                          ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {isUp ? '+' : ''}{change.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: balance */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 15,
                                  color: 'var(--color-text)' }}>
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
      )}
    </div>
  );
}
