import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Sparkline = ({ change }: { change: number }) => {
  const isUp  = change >= 0;
  const color = isUp ? '#0ecb81' : '#f6465d';
  const points = [40,38,42,35,45,38,50,44,48,42,55,50,isUp ? 58 : 35];
  const max   = Math.max(...points);
  const min   = Math.min(...points);
  const norm  = (v: number) => 40 - ((v - min) / (max - min)) * 36;
  const coords = points.map((p, i) =>
    `${(i / (points.length - 1)) * 80},${norm(p)}`).join(' ');
  return (
    <svg width="80" height="40" viewBox="0 0 80 40">
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

interface Props {
  totalBalance: string;
  hideBalance: boolean;
  portfolioChange: number;
  onToggleHide: () => void;
}

export default function HomeBalance({ totalBalance, hideBalance, portfolioChange, onToggleHide }: Props) {
  const navigate = useNavigate();
  const changeUp = portfolioChange >= 0;

  return (
    <div style={{ background: 'var(--color-bg)', padding: '24px 20px 20px' }}>

      {/* Balance + sparkline */}
      <div style={{ display: 'flex', alignItems: 'flex-start',
                    justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>Total Balance</span>
            <button onClick={onToggleHide} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-muted)', display: 'flex' }}>
              {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--color-text)',
                           letterSpacing: -1 }}>
              {hideBalance ? '••••••' : totalBalance}
            </span>
            <span style={{ fontSize: 14, color: 'var(--color-muted)' }}>USDT</span>
          </div>
          {!hideBalance && (
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600,
                             color: changeUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {changeUp ? '+' : ''}{portfolioChange.toFixed(2)}%
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>24h</span>
            </div>
          )}
        </div>
        {!hideBalance && (
          <div style={{ paddingTop: 8 }}>
            <Sparkline change={portfolioChange} />
          </div>
        )}
      </div>

      {/* Deposit button */}
      <button onClick={() => navigate('/deposit')} style={{
        width: '100%', padding: '16px', borderRadius: 14, border: 'none',
        background: 'var(--color-primary)', color: '#000',
        fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 20
      }}>Deposit</button>
    </div>
  );
}
