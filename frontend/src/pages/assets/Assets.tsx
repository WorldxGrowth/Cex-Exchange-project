import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI } from '../../services/api';
import { ArrowDownLeft, ArrowUpRight, Repeat, Eye, EyeOff,
         History, Search } from 'lucide-react';

type TabType = 'overview' | 'spot' | 'futures' | 'funding' | 'earn';

export default function Assets() {
  const navigate = useNavigate();
  const [allBalances, setAllBalances] = useState<any[]>([]);
  const [totalUsdt, setTotalUsdt] = useState('0.00');
  const [hideBalance, setHideBalance] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    walletAPI.getBalances().then((res: any) => {
      setAllBalances(res.data.balances || []);
      setTotalUsdt(parseFloat(res.data.total_usdt || 0).toFixed(2));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const byType = (type: string) => allBalances.filter((b: any) =>
    b.account_type === type
  );

  const totalByType = (type: string) =>
    byType(type).reduce((sum: number, b: any) =>
      sum + parseFloat(b.total_usdt_value || 0), 0).toFixed(2);

  const mask = (val: string) => hideBalance ? '****' : val;

  const tabs: { key: TabType; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'spot',     label: 'Spot' },
    { key: 'futures',  label: 'Futures' },
    { key: 'funding',  label: 'Funding' },
    { key: 'earn',     label: 'Earn' },
  ];

  const actions = [
    { icon: ArrowDownLeft, label: 'Deposit',  path: '/deposit',         color: 'var(--color-success)' },
    { icon: ArrowUpRight,  label: 'Withdraw', path: '/withdraw',        color: 'var(--color-danger)' },
    { icon: Repeat,        label: 'Transfer', path: '/transfer',        color: '#1890ff' },
    { icon: History,       label: 'History',  path: '/deposit-history', color: 'var(--color-primary)' },
  ];

  const filteredByType = (type: string) => {
    const list = byType(type);
    return list.filter((b: any) =>
      !search ||
      b.symbol?.toLowerCase().includes(search.toLowerCase()) ||
      b.name?.toLowerCase().includes(search.toLowerCase())
    );
  };

  // Tab label for balance header
  const tabLabel: any = {
    overview: 'Total',
    spot:     'Est. balance',
    futures:  'Margin balance',
    funding:  'Funding balance',
    earn:     'Earn balance'
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', paddingBottom: 20 }}>

      {/* ===== TABS - SABABSE UPAR ===== */}
      <div style={{ background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)',
                    overflowX: 'auto', display: 'flex', scrollbarWidth: 'none' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSearch(''); }} style={{
            padding: '12px 16px', background: 'none', border: 'none',
            cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 14, fontWeight: 600,
            color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-muted)',
            borderBottom: activeTab === tab.key
              ? '2px solid var(--color-primary)' : '2px solid transparent',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== BALANCE HEADER (changes per tab) ===== */}
      <div style={{ background: 'var(--color-surface)', padding: '20px 16px 16px',
                    borderBottom: '1px solid var(--color-border)' }}>

        {/* Balance title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 13, color: 'var(--color-muted)', marginBottom: 4 }}>
          <span>{tabLabel[activeTab]}</span>
          <button onClick={() => setHideBalance(!hideBalance)}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
                     color: 'var(--color-muted)', padding: 0 }}>
            {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {/* Balance amount */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-text)' }}>
            {mask(activeTab === 'overview'
              ? parseFloat(totalUsdt).toLocaleString()
              : parseFloat(totalByType(activeTab)).toLocaleString()
            )}
          </span>
          <span style={{ fontSize: 14, color: 'var(--color-muted)' }}>USDT</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 16 }}>
          ≈ ${mask(activeTab === 'overview'
            ? parseFloat(totalUsdt).toLocaleString()
            : parseFloat(totalByType(activeTab)).toLocaleString()
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {actions.map(({ icon: Icon, label, path, color }) => (
            <button key={label} onClick={() => navigate(path)} style={{
              flex: 1, padding: '10px 4px', borderRadius: 12, border: 'none',
              background: 'var(--color-surface2)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
            }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%',
                            background: color + '20',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={color} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-text)', fontWeight: 500 }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ===== OVERVIEW TAB CONTENT ===== */}
      {activeTab === 'overview' && (
        <div style={{ padding: '16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
                        marginBottom: 12 }}>Account</div>
          {[
            { type: 'spot',    label: 'Spot' },
            { type: 'futures', label: 'Futures' },
            { type: 'funding', label: 'Funding' },
            { type: 'earn',    label: 'Earn' },
          ].map(({ type, label }) => (
            <div key={type} onClick={() => setActiveTab(type as TabType)}
              style={{ display: 'flex', justifyContent: 'space-between',
                       padding: '14px 0', cursor: 'pointer',
                       borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 15, color: 'var(--color-text)' }}>{label}</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                  {mask(parseFloat(totalByType(type)).toLocaleString())} USDT
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  ${mask(parseFloat(totalByType(type)).toLocaleString())}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== SPOT / FUTURES / FUNDING / EARN TAB CONTENT ===== */}
      {activeTab !== 'overview' && (
        <div>
          {/* Search */}
          <div style={{ padding: '12px 16px',
                        borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
              <input placeholder="Search coin..." value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 20,
                         border: '1px solid var(--color-border)',
                         background: 'var(--color-surface2)',
                         color: 'var(--color-text)', fontSize: 13, outline: 'none',
                         boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Assets label */}
          <div style={{ padding: '12px 16px 4px',
                        fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
            Assets
          </div>

          {/* Token List */}
          <div style={{ padding: '0 16px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40,
                            color: 'var(--color-muted)' }}>Loading...</div>
            ) : filteredByType(activeTab).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
                <div style={{ color: 'var(--color-muted)', fontSize: 14, marginBottom: 16 }}>
                  No assets in {activeTab}
                </div>
                {activeTab === 'spot' && (
                  <button onClick={() => navigate('/deposit')} style={{
                    padding: '10px 24px', borderRadius: 8,
                    background: 'var(--color-primary)', border: 'none',
                    color: '#000', fontWeight: 700, cursor: 'pointer'
                  }}>Deposit Now</button>
                )}
              </div>
            ) : filteredByType(activeTab).map((b: any) => (
              <div key={b.symbol + b.account_type}
                style={{ display: 'flex', alignItems: 'center',
                         justifyContent: 'space-between',
                         padding: '14px 0',
                         borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {b.logo_url
                    ? <img src={b.logo_url} alt=""
                        style={{ width: 38, height: 38, borderRadius: '50%' }}
                        onError={(e) => { (e.target as any).style.display = 'none'; }} />
                    : <div style={{ width: 38, height: 38, borderRadius: '50%',
                                    background: 'var(--color-surface2)',
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontWeight: 700,
                                    color: 'var(--color-primary)', fontSize: 13 }}>
                        {b.symbol?.charAt(0)}
                      </div>
                  }
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14,
                                  color: 'var(--color-text)' }}>{b.symbol}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)',
                                  marginTop: 1 }}>{b.name}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                    {mask(parseFloat(b.available || 0).toFixed(6))}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                    ≈${mask(parseFloat(b.total_usdt_value || 0).toFixed(2))}
                  </div>
                  {parseFloat(b.locked || 0) > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--color-warning)' }}>
                      Locked: {parseFloat(b.locked).toFixed(6)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
