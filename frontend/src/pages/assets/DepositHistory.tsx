import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI } from '../../services/api';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';

const DATE_FILTERS = [
  { label: 'All',    days: 0   },
  { label: 'Today',  days: 1   },
  { label: '7D',     days: 7   },
  { label: '30D',    days: 30  },
  { label: '90D',    days: 90  },
];

const statusColor: any = {
  completed: 'var(--color-success)',
  approved:  'var(--color-success)',
  pending:   'var(--color-warning)',
  processing:'var(--color-warning)',
  failed:    'var(--color-danger)',
  rejected:  'var(--color-danger)',
};

export default function DepositHistory() {
  const navigate = useNavigate();
  const [tab, setTab]           = useState<'deposit'|'withdraw'>('deposit');
  const [allDeposits, setAllDeposits]   = useState<any[]>([]);
  const [allWithdraws, setAllWithdraws] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [coinFilter, setCoinFilter]     = useState('ALL');
  const [dateFilter, setDateFilter]     = useState(0);
  const [coins, setCoins]       = useState<string[]>([]);
  const [showFilters, setShowFilters]   = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      walletAPI.getDepositHistory().catch(() => ({ data: [] })),
      walletAPI.getWithdrawalHistory().catch(() => ({ data: [] })),
    ]).then(([depRes, withRes]: any) => {
      const deps = depRes.data || [];
      const withs = withRes.data || [];
      setAllDeposits(deps);
      setAllWithdraws(withs);
      // Unique coins from both
      const allSymbols = [...new Set([
        ...deps.map((d: any) => d.symbol),
        ...withs.map((w: any) => w.symbol || w.coin)
      ].filter(Boolean))] as string[];
      setCoins(allSymbols);
      setLoading(false);
    });
  }, []);

  const filterData = (data: any[]) => {
    let filtered = [...data];
    // Coin filter
    if (coinFilter !== 'ALL') {
      filtered = filtered.filter(d =>
        (d.symbol || d.coin || '').toUpperCase() === coinFilter
      );
    }
    // Date filter
    if (dateFilter > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - dateFilter);
      filtered = filtered.filter(d =>
        new Date(d.created_at) >= cutoff
      );
    }
    return filtered;
  };

  const currentData = filterData(
    tab === 'deposit' ? allDeposits : allWithdraws
  );

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)', flex: 1 }}>
          Transaction History
        </span>
        <button onClick={() => setShowFilters(!showFilters)} style={{
          background: showFilters ? 'var(--color-surface2)' : 'none',
          border: '1px solid var(--color-border)',
          borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
          color: coinFilter !== 'ALL' || dateFilter > 0
            ? 'var(--color-primary)' : 'var(--color-muted)',
          display: 'flex', alignItems: 'center', gap: 4, fontSize: 13
        }}>
          <Filter size={15} />
          {coinFilter !== 'ALL' || dateFilter > 0 ? 'Filtered' : 'Filter'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        {(['deposit', 'withdraw'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '12px', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 14, fontWeight: tab === t ? 600 : 400,
            color: tab === t ? 'var(--color-primary)' : 'var(--color-muted)',
            borderBottom: tab === t
              ? '2px solid var(--color-primary)' : '2px solid transparent'
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {tab === t && (
              <span style={{ marginLeft: 6, fontSize: 11,
                             background: 'var(--color-surface2)',
                             padding: '1px 6px', borderRadius: 10 }}>
                {filterData(t === 'deposit' ? allDeposits : allWithdraws).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div style={{ background: 'var(--color-surface)',
                      borderBottom: '1px solid var(--color-border)',
                      padding: '12px 16px' }}>

          {/* Date filters */}
          <div style={{ fontSize: 12, color: 'var(--color-muted)',
                        marginBottom: 8 }}>Date Range</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12,
                        flexWrap: 'wrap' }}>
            {DATE_FILTERS.map(df => (
              <button key={df.days} onClick={() => setDateFilter(df.days)} style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12,
                border: '1px solid var(--color-border)', cursor: 'pointer',
                background: dateFilter === df.days
                  ? 'var(--color-primary)' : 'var(--color-surface2)',
                color: dateFilter === df.days ? '#000' : 'var(--color-text)',
                fontWeight: dateFilter === df.days ? 700 : 400
              }}>{df.label}</button>
            ))}
          </div>

          {/* Coin filter */}
          <div style={{ fontSize: 12, color: 'var(--color-muted)',
                        marginBottom: 8 }}>Coin</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setCoinFilter('ALL')} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12,
              border: '1px solid var(--color-border)', cursor: 'pointer',
              background: coinFilter === 'ALL'
                ? 'var(--color-primary)' : 'var(--color-surface2)',
              color: coinFilter === 'ALL' ? '#000' : 'var(--color-text)',
              fontWeight: coinFilter === 'ALL' ? 700 : 400
            }}>All</button>
            {coins.map(c => (
              <button key={c} onClick={() => setCoinFilter(c)} style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12,
                border: '1px solid var(--color-border)', cursor: 'pointer',
                background: coinFilter === c
                  ? 'var(--color-primary)' : 'var(--color-surface2)',
                color: coinFilter === c ? '#000' : 'var(--color-text)',
                fontWeight: coinFilter === c ? 700 : 400
              }}>{c}</button>
            ))}
          </div>

          {/* Reset */}
          {(coinFilter !== 'ALL' || dateFilter > 0) && (
            <button onClick={() => { setCoinFilter('ALL'); setDateFilter(0); }}
              style={{ marginTop: 10, padding: '6px 16px', borderRadius: 8,
                       border: '1px solid var(--color-border)', cursor: 'pointer',
                       background: 'transparent', color: 'var(--color-danger)',
                       fontSize: 12 }}>
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* List */}
      <div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40,
                        color: 'var(--color-muted)' }}>Loading...</div>
        ) : currentData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ color: 'var(--color-muted)', fontSize: 14,
                          fontWeight: 600 }}>No records found</div>
            {(coinFilter !== 'ALL' || dateFilter > 0) && (
              <div style={{ color: 'var(--color-muted)', fontSize: 12,
                            marginTop: 6 }}>Try changing filters</div>
            )}
          </div>
        ) : currentData.map((d: any) => (
          <div key={d.id}
            style={{ padding: '14px 16px',
                     borderBottom: '1px solid var(--color-border)',
                     display: 'flex', alignItems: 'center',
                     justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => {
              if (tab === 'deposit') navigate('/deposit-detail/' + d.id);
              if (tab === 'withdraw') navigate('/withdraw-detail/' + d.id);
            }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600,
                            color: 'var(--color-text)', marginBottom: 3 }}>
                {d.symbol || d.coin || '--'} •{' '}
                <span style={{ color: tab === 'deposit'
                  ? 'var(--color-success)' : 'var(--color-danger)',
                  fontSize: 13 }}>
                  {tab === 'deposit' ? '↓ Deposit' : '↑ Withdraw'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                {new Date(d.created_at).toLocaleDateString('en', {
                  month: '2-digit', day: '2-digit', year: '2-digit'
                })}{' '}
                {new Date(d.created_at).toLocaleTimeString([], {
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                })}
              </div>
              {d.network && (
                <div style={{ fontSize: 11, color: 'var(--color-muted)',
                              marginTop: 2 }}>{d.network}</div>
              )}
            </div>
            <div style={{ textAlign: 'right', display: 'flex',
                          alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600,
                               color: 'var(--color-text)' }}>
                  {parseFloat(d.amount || d.requested_amount || 0).toFixed(6)}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600,
                               color: statusColor[d.status] || 'var(--color-muted)' }}>
                  • {(d.status || '--').charAt(0).toUpperCase()
                    + (d.status || '--').slice(1)}
                </div>
              </div>
              {tab === 'deposit' && (
                <ChevronRight size={16} color="var(--color-muted)" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
