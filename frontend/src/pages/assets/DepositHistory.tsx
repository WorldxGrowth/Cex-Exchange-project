import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI } from '../../services/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function DepositHistory() {
  const navigate = useNavigate();
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'deposit'|'withdraw'>('deposit');

  useEffect(() => {
    walletAPI.getDepositHistory().then((res: any) => {
      setDeposits(res.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const statusColor: any = {
    completed: 'var(--color-success)',
    pending:   'var(--color-warning)',
    failed:    'var(--color-danger)'
  };

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
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
          Transaction History
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        {(['deposit', 'withdraw'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '12px', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 14, fontWeight: tab === t ? 600 : 400,
            color: tab === t ? 'var(--color-primary)' : 'var(--color-muted)',
            borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent'
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40,
                        color: 'var(--color-muted)' }}>Loading...</div>
        ) : deposits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ color: 'var(--color-muted)', fontSize: 14 }}>No records found</div>
          </div>
        ) : deposits.map((d: any) => (
          <div key={d.id}
            style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)',
                     display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                     cursor: 'pointer' }}
            onClick={() => navigate('/deposit-detail/' + d.id)}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)',
                            marginBottom: 3 }}>
                {d.symbol} - On-chain
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                {new Date(d.created_at).toLocaleDateString('en',
                  { month: '2-digit', day: '2-digit' })} {new Date(d.created_at)
                    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit',
                                             second: '2-digit' })}
              </div>
            </div>
            <div style={{ textAlign: 'right', display: 'flex',
                          alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                  {parseFloat(d.amount).toFixed(8)}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600,
                               color: statusColor[d.status] || 'var(--color-muted)' }}>
                  • {d.status?.charAt(0).toUpperCase() + d.status?.slice(1)}
                </div>
              </div>
              <ChevronRight size={16} color="var(--color-muted)" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
