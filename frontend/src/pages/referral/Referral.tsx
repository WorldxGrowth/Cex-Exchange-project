import { useEffect, useState } from 'react';
import { referralAPI } from '../../services/api';
import { Copy, Users, DollarSign, TrendingUp, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Referral() {
  const [info, setInfo] = useState<any>(null);
  const [list, setList] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview'|'list'>('overview');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    referralAPI.getInfo().then((res: any) => setInfo(res.data));
    referralAPI.getList().then((res: any) => setList(res.data || []));
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    padding: '24px 16px 32px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
          🎁 Referral Program
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
          Invite friends and earn <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
          {info?.commission_rate || '40%'}</span> commission on every trade
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                    padding: '16px', marginTop: -16 }}>
        {[
          { icon: Users, label: 'Total Referrals', value: info?.total_referrals || 0, color: '#1890ff' },
          { icon: DollarSign, label: 'Total Earned', value: `$${parseFloat(info?.total_earned || 0).toFixed(2)}`, color: '#0ecb81' },
          { icon: TrendingUp, label: 'Commission Rate', value: info?.commission_rate || '40%', color: '#f0b90b' },
          { icon: DollarSign, label: 'Pending', value: `$${parseFloat(info?.pending_commission || 0).toFixed(2)}`, color: '#722ed1' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{ background: 'var(--color-surface)',
                                     border: '1px solid var(--color-border)',
                                     borderRadius: 12, padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8,
                            background: color + '20', display: 'flex',
                            alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={color} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Referral Code */}
      <div style={{ margin: '0 16px 16px', padding: '16px',
                    background: 'var(--color-surface)', borderRadius: 12,
                    border: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8 }}>
          Your Referral Code
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8,
                        background: 'var(--color-surface2)',
                        fontSize: 18, fontWeight: 800, color: 'var(--color-primary)',
                        letterSpacing: 2 }}>
            {info?.referral_code || '---'}
          </div>
          <button onClick={() => handleCopy(info?.referral_code || '')} style={{
            padding: '10px 16px', borderRadius: 8, border: 'none',
            background: copied ? 'var(--color-success)' : 'var(--color-primary)',
            color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Referral Link */}
      <div style={{ margin: '0 16px 16px', padding: '14px',
                    background: 'var(--color-surface)', borderRadius: 12,
                    border: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>
          Referral Link
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text)', wordBreak: 'break-all',
                      marginBottom: 10, fontFamily: 'monospace' }}>
          {info?.referral_link || '---'}
        </div>
        <button onClick={() => handleCopy(info?.referral_link || '')} style={{
          width: '100%', padding: '10px', borderRadius: 8,
          background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
          color: 'var(--color-text)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
        }}>
          <Copy size={14} /> Copy Referral Link
        </button>
      </div>

      {/* How it works */}
      <div style={{ margin: '0 16px', padding: '16px',
                    background: 'var(--color-surface)', borderRadius: 12,
                    border: '1px solid var(--color-border)' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)', marginBottom: 14 }}>
          How it works
        </div>
        {[
          { step: '1', text: 'Share your referral code or link with friends' },
          { step: '2', text: 'Friend registers using your code' },
          { step: '3', text: `You earn ${info?.commission_rate || '40%'} of their trading fees forever` },
        ].map(({ step, text }) => (
          <div key={step} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: 'var(--color-primary)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: '#000' }}>
              {step}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text)', paddingTop: 4 }}>{text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
