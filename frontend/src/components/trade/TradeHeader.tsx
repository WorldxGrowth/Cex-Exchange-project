import { useNavigate } from 'react-router-dom';
import { ChevronDown, CandlestickChart, MoreHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  baseSym: string;
  change24h: number;
  isUp: boolean;
  showTrades: boolean;
  activeTopTab: 'spot' | 'earn';
  sym: string;
  onToggleTrades: () => void;
  onTopTabChange: (tab: 'spot' | 'earn') => void;
}

export default function TradeHeader({
  baseSym, change24h, isUp, showTrades,
  activeTopTab, sym, onToggleTrades, onTopTabChange
}: Props) {
  const navigate = useNavigate();

  return (
    <div style={{ background: 'var(--color-bg)', flexShrink: 0,
                  borderBottom: '1px solid var(--color-border)' }}>

      {/* Top tabs */}
      <div style={{ display: 'flex', padding: '8px 16px 0', gap: 20 }}>
        {(['spot', 'earn'] as const).map(tab => (
          <button key={tab} onClick={() => {
            if (tab === 'earn') { toast('Earn — Coming soon'); return; }
            onTopTabChange(tab);
          }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 700, paddingBottom: 8,
            color: activeTopTab === tab ? 'var(--color-text)' : 'var(--color-muted)',
            borderBottom: activeTopTab === tab
              ? '2px solid var(--color-primary)' : '2px solid transparent',
            textTransform: 'capitalize'
          }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Symbol row */}
      <div style={{ display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          onClick={() => navigate('/markets')}>
          <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--color-text)' }}>
            {baseSym}
          </span>
          <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>/USDT</span>
          <ChevronDown size={14} color="var(--color-muted)" />
          <span style={{ fontSize: 12, fontWeight: 700, marginLeft: 2,
                         color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {isUp ? '+' : ''}{change24h.toFixed(2)}%
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={onToggleTrades}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 4, height: 4, borderRadius: 1,
                  background: showTrades ? 'var(--color-primary)' : 'var(--color-muted)' }} />
              ))}
            </div>
          </button>
          <CandlestickChart size={20} color="var(--color-muted)"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/chart/' + sym)} />
          <MoreHorizontal size={20} color="var(--color-muted)" style={{ cursor: 'pointer' }} />
        </div>
      </div>
    </div>
  );
}
