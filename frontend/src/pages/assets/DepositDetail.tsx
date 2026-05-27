import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { walletAPI } from '../../services/api';
import { ChevronLeft, CheckCircle, Clock, XCircle, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DepositDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [deposit, setDeposit] = useState<any>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    walletAPI.getDepositHistory().then((res: any) => {
      const found = (res.data || []).find((d: any) => String(d.id) === String(id));
      setDeposit(found || null);
    });
  }, [id]);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copied!');
    setTimeout(() => setCopied(''), 2000);
  };

  const statusColor: any = {
    completed: 'var(--color-success)',
    pending:   'var(--color-warning)',
    failed:    'var(--color-danger)'
  };

  const StatusIcon = ({ status }: any) => {
    if (status === 'completed') return <CheckCircle size={48} color="var(--color-success)" />;
    if (status === 'failed') return <XCircle size={48} color="var(--color-danger)" />;
    return <Clock size={48} color="var(--color-warning)" />;
  };

  if (!deposit) return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
          Deposit Details
        </span>
      </div>
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-muted)' }}>
        Loading...
      </div>
    </div>
  );

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
          Deposit Details
        </span>
      </div>

      <div style={{ padding: '30px 16px 20px', textAlign: 'center' }}>
        {/* Status Icon */}
        <StatusIcon status={deposit.status} />

        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8, marginBottom: 4,
                      color: statusColor[deposit.status] }}>
          {deposit.status?.charAt(0).toUpperCase() + deposit.status?.slice(1)}
        </div>

        {/* Amount */}
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text)',
                      marginTop: 12 }}>
          {parseFloat(deposit.amount).toFixed(8)} {deposit.symbol}
        </div>
      </div>

      {/* Details Card */}
      <div style={{ margin: '0 16px', background: 'var(--color-surface)',
                    borderRadius: 12, border: '1px solid var(--color-border)',
                    overflow: 'hidden' }}>
        {[
          { label: 'Network', value: deposit.network || 'BSC', copyable: false },
          { label: 'Type', value: 'On-chain', copyable: false },
          { label: 'Confirmations', value: `${deposit.confirmations || 0}/${deposit.required_confirmations || 3}`,
            copyable: false },
          { label: 'Status', value: deposit.status?.charAt(0).toUpperCase() + deposit.status?.slice(1),
            copyable: false, color: statusColor[deposit.status] },
          { label: 'Deposit address', value: deposit.to_address, copyable: true, truncate: true },
          { label: 'TxID', value: deposit.txhash, copyable: true, truncate: true },
          { label: 'Time', value: new Date(deposit.created_at).toLocaleString('en',
            { year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            copyable: false },
        ].map(({ label, value, copyable, truncate, color }: any, i, arr) => (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px',
            borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none'
          }}>
            <span style={{ fontSize: 13, color: 'var(--color-muted)', flexShrink: 0 }}>
              {label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                          maxWidth: '60%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 13, fontWeight: 500,
                             color: color || 'var(--color-text)',
                             overflow: 'hidden', textOverflow: 'ellipsis',
                             whiteSpace: truncate ? 'nowrap' : 'normal',
                             textAlign: 'right', wordBreak: 'break-all' }}>
                {truncate && value
                  ? value.slice(0, 8) + '...' + value.slice(-6)
                  : value || '---'}
              </span>
              {copyable && value && (
                <button onClick={() => copyText(value, label)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: copied === label ? 'var(--color-success)' : 'var(--color-muted)',
                  padding: 0, flexShrink: 0
                }}>
                  {copied === label ? <Check size={14} /> : <Copy size={14} />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
