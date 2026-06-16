import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { walletAPI } from '../../services/api';
import { ChevronLeft, Copy, ExternalLink } from 'lucide-react';

const statusColor: any = {
  completed:  'var(--color-success)',
  approved:   'var(--color-success)',
  pending:    'var(--color-warning)',
  processing: 'var(--color-warning)',
  failed:     'var(--color-danger)',
  rejected:   'var(--color-danger)',
};

const statusBg: any = {
  completed:  'rgba(14,203,129,0.1)',
  approved:   'rgba(14,203,129,0.1)',
  pending:    'rgba(240,185,11,0.1)',
  processing: 'rgba(240,185,11,0.1)',
  failed:     'rgba(246,70,93,0.1)',
  rejected:   'rgba(246,70,93,0.1)',
};

function useIsDesktop() {
  const [d, setD] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const h = () => setD(window.innerWidth >= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return d;
}

export default function WithdrawDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    walletAPI.getWithdrawalHistory().then((res: any) => {
      const all = res.data || [];
      const found = all.find((w: any) => String(w.id) === String(id));
      setRecord(found || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  if (loading) return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-muted)' }}>Loading...</div>
    </div>
  );

  if (!record) return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Withdraw Detail</span>
      </div>
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <div style={{ color: 'var(--color-muted)' }}>Record not found</div>
      </div>
    </div>
  );

  const status = record.status || 'pending';
  const rows = [
    { label: 'Coin',           value: `${record.name || ''} (${record.symbol || ''})` },
    { label: 'Network',        value: record.network_name || '--' },
    { label: 'Amount',         value: `${parseFloat(record.amount || 0).toFixed(8)} ${record.symbol}` },
    { label: 'Fee',            value: `${parseFloat(record.fee || 0).toFixed(8)} ${record.symbol}` },
    { label: 'Receive Amount', value: `${parseFloat(record.receive_amount || 0).toFixed(8)} ${record.symbol}`, highlight: true },
    { label: 'To Address',     value: record.to_address || '--', copyKey: 'address' },
    { label: 'TxHash',         value: record.txhash || '--', copyKey: 'txhash', isHash: true },
    { label: 'Time',           value: record.created_at
        ? new Date(record.created_at).toLocaleString('en', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          })
        : '--' },
  ];

  const contentMaxWidth = desktop ? 580 : '100%';
  const contentMargin   = desktop ? '32px auto' : '0';
  const contentPadding  = desktop ? '0 0 40px' : '0 0 32px';

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12,
                    padding: desktop ? '14px 24px' : '12px 16px',
                    background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
          Withdraw Detail
        </span>
      </div>

      {/* Content wrapper — centered on desktop */}
      <div style={{ maxWidth: contentMaxWidth, margin: contentMargin,
                    padding: contentPadding }}>

        {/* Status Card */}
        <div style={{ margin: desktop ? '24px 0 16px' : '16px',
                      padding: desktop ? '28px 32px' : '20px',
                      background: statusBg[status] || 'var(--color-surface)',
                      borderRadius: desktop ? 20 : 16, textAlign: 'center',
                      border: `1px solid ${statusColor[status] || 'var(--color-border)'}` }}>
          <div style={{ fontSize: desktop ? 48 : 36, marginBottom: 10 }}>
            {['completed','approved'].includes(status) ? '✅' :
             ['pending','processing'].includes(status) ? '⏳' : '❌'}
          </div>
          <div style={{ fontSize: desktop ? 28 : 22, fontWeight: 700,
                        color: 'var(--color-text)', marginBottom: 8 }}>
            -{parseFloat(record.amount || 0).toFixed(6)} {record.symbol}
          </div>
          <div style={{ display: 'inline-block', padding: '6px 20px', borderRadius: 20,
                        background: statusColor[status] || 'var(--color-muted)',
                        color: '#fff', fontSize: 14, fontWeight: 600 }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
        </div>

        {/* Details */}
        <div style={{ margin: desktop ? '0 0 16px' : '0 16px 16px',
                      background: 'var(--color-surface)',
                      borderRadius: desktop ? 20 : 16, overflow: 'hidden',
                      border: '1px solid var(--color-border)' }}>
          {rows.map((row, i) => (
            <div key={i} style={{
              padding: desktop ? '15px 20px' : '13px 16px',
              borderBottom: i < rows.length - 1
                ? '1px solid var(--color-border)' : 'none',
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', gap: 12
            }}>
              <span style={{ fontSize: 13, color: 'var(--color-muted)',
                             flexShrink: 0, paddingTop: 1, minWidth: 110 }}>
                {row.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center',
                            gap: 6, textAlign: 'right' }}>
                <span style={{
                  fontSize: 13, fontWeight: row.highlight ? 700 : 500,
                  color: row.highlight ? 'var(--color-success)' : 'var(--color-text)',
                  wordBreak: 'break-all',
                  maxWidth: row.copyKey ? (desktop ? '320px' : '180px') : 'auto'
                }}>
                  {row.value === '--' ? '--' : row.value}
                </span>
                {row.copyKey && row.value !== '--' && (
                  <button onClick={() => copy(row.value, row.copyKey!)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: copied === row.copyKey
                      ? 'var(--color-success)' : 'var(--color-muted)',
                    flexShrink: 0, padding: 2
                  }}>
                    <Copy size={14} />
                  </button>
                )}
                {row.isHash && record.txhash && record.txhash !== '--' && (
                  <a href={`https://bscscan.com/tx/${record.txhash}`}
                     target="_blank" rel="noreferrer"
                     style={{ color: 'var(--color-muted)' }}>
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Back Button */}
        <div style={{ padding: desktop ? '0' : '0 16px' }}>
          <button onClick={() => navigate(-1)} style={{
            width: '100%', padding: '14px', borderRadius: 12,
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text)', fontSize: 15, fontWeight: 600,
            cursor: 'pointer'
          }}>Back to History</button>
        </div>
      </div>
    </div>
  );
}
