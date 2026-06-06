import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Repeat, BarChart2 } from 'lucide-react';
import { walletAPI } from '../../services/api';
import { useStore } from '../../store/useStore';

export default function TokenDetail() {
  const { symbol }  = useParams();
  const navigate    = useNavigate();
  const { prices }  = useStore();
  const sym         = symbol?.toUpperCase() || '';

  const [balance, setBalance]     = useState<any>(null);
  const [deposits, setDeposits]   = useState<any[]>([]);
  const [withdraws, setWithdraws] = useState<any[]>([]);
  const [tab, setTab]             = useState<'deposit'|'withdraw'>('deposit');
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      walletAPI.getBalances(),
      walletAPI.getDepositHistory({ coin: sym, limit: 10 }),
      walletAPI.getWithdrawalHistory({ coin: sym, limit: 10 }),
    ]).then(([balRes, depRes, wdRes]: any) => {
      const bal = (balRes.data.balances || []).find(
        (b: any) => b.symbol === sym && b.account_type === 'spot'
      );
      setBalance(bal || null);
      setDeposits(depRes.data || []);
      setWithdraws(wdRes.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [sym]);

  const live      = prices[sym + 'USDT'] || prices[sym];
  const price     = parseFloat(live?.price || balance?.price_usdt || '0');
  const change    = parseFloat(live?.change_24h || balance?.change_24h || '0');
  const isUp      = change >= 0;
  const available = parseFloat(balance?.available || '0');
  const locked    = parseFloat(balance?.locked || '0');
  const total     = available + locked;
  const usdVal    = total * price;

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const statusColor: any = {
    completed: 'var(--color-success)',
    processing: '#f0b90b',
    pending: '#f0b90b',
    failed: 'var(--color-danger)',
    cancelled: 'var(--color-muted)',
  };

  if (loading) return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-muted)' }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', borderBottom: '1px solid var(--color-border)',
                    position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10 }}>
        <ArrowLeft size={20} color="var(--color-text)" style={{ cursor: 'pointer' }}
          onClick={() => navigate(-1)} />
        {balance?.logo_url
          ? <img src={balance.logo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
          : <div style={{ width: 28, height: 28, borderRadius: '50%',
                          background: 'var(--color-surface2)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, color: 'var(--color-primary)', fontSize: 13 }}>
              {sym.charAt(0)}
            </div>
        }
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>{sym}</span>
      </div>

      {/* Balance section */}
      <div style={{ padding: '24px 20px 20px', textAlign: 'center',
                    borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>
          Asset balance
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-text)',
                      letterSpacing: -1, marginBottom: 4 }}>
          {total.toFixed(6)}
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 16 }}>
          ≈ ${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>

        {/* Balance details */}
        <div style={{ background: 'var(--color-surface)', borderRadius: 12,
                      padding: '12px 16px', textAlign: 'left',
                      border: '1px solid var(--color-border)', marginBottom: 16 }}>
          {[
            ['Available', `${available.toFixed(6)} ${sym}`],
            ['Unavailable', `0.000000 ${sym}`],
            ['Locked', `${locked.toFixed(6)} ${sym}`],
            ["Today's PnL", `${isUp ? '+' : ''}${change.toFixed(2)}%`],
          ].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                                      padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600,
                             color: label === "Today's PnL"
                               ? (isUp ? 'var(--color-success)' : 'var(--color-danger)')
                               : 'var(--color-text)' }}>
                {val}
              </span>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          {[
            { icon: ArrowDownLeft, label: 'Deposit',  color: '#0ecb81',
              action: () => navigate(`/deposit?coin=${sym}`) },
            { icon: ArrowUpRight,  label: 'Withdraw', color: '#f6465d',
              action: () => navigate(`/withdraw?coin=${sym}`) },
            { icon: Repeat,        label: 'Transfer', color: '#1890ff',
              action: () => navigate(`/transfer?coin=${sym}`) },
            { icon: BarChart2,     label: 'Trade',    color: '#f0b90b',
              action: () => navigate(`/trade/${sym}USDT`) },
          ].map(({ icon: Icon, label, color, action }) => (
            <button key={label} onClick={action} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
            }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={color} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--color-text)', fontWeight: 500 }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Markets placeholder */}
      <div style={{ padding: '16px 16px 8px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)',
                      marginBottom: 10 }}>Markets</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[`${sym}/USDT`].map(pair => (
            <div key={pair} onClick={() => navigate(`/trade/${sym}USDT`)}
              style={{ flex: 1, background: 'var(--color-surface)', borderRadius: 12,
                       padding: '12px 14px', cursor: 'pointer',
                       border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 4 }}>
                {pair}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)',
                            marginBottom: 2 }}>
                {price > 0 ? price.toLocaleString(undefined,
                  { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '--'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600,
                            color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {isUp ? '+' : ''}{change.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* History tabs */}
      <div style={{ padding: '16px 16px 8px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)',
                      marginBottom: 10 }}>History</div>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)',
                      marginBottom: 12 }}>
          {(['deposit', 'withdraw'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 16px', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 700 : 400,
              color: tab === t ? 'var(--color-text)' : 'var(--color-muted)',
              borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
              textTransform: 'capitalize'
            }}>{t === 'deposit' ? 'Deposit' : 'Withdraw'}</button>
          ))}
        </div>

        {/* History list */}
        {(tab === 'deposit' ? deposits : withdraws).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0',
                        color: 'var(--color-muted)', fontSize: 13 }}>
            No {tab} history
          </div>
        ) : (tab === 'deposit' ? deposits : withdraws).map((item: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                                 alignItems: 'center', padding: '12px 0',
                                 borderBottom: '1px solid var(--color-border)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
                            marginBottom: 3 }}>
                {tab === 'deposit' ? 'Deposit' : 'Withdraw'} {item.symbol}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                {fmtDate(item.created_at)}
              </div>
              {item.network_name && (
                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                  {item.network_name}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700,
                            color: tab === 'deposit'
                              ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {tab === 'deposit' ? '+' : '-'}{parseFloat(item.amount).toFixed(4)} {sym}
              </div>
              <div style={{ fontSize: 11, marginTop: 3, textTransform: 'capitalize',
                            color: statusColor[item.status] || 'var(--color-muted)' }}>
                {item.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
