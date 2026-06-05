import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, RefreshCw, Bell, Star } from 'lucide-react';

interface Props {
  baseSym: string;
  sym: string;
  currentPrice: number;
  change24h: number;
  isUp: boolean;
  high24h: number;
  low24h: number;
  volume24h: number;
  starred: boolean;
  onStarToggle: () => void;
  onRefresh: () => void;
}

export default function ChartHeader({
  baseSym, sym, currentPrice, change24h, isUp,
  high24h, low24h, volume24h, starred, onStarToggle, onRefresh
}: Props) {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)',
                  flexShrink: 0, background: 'var(--color-bg)' }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigate(-1)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text)', padding: 0 }}>
            <ChevronLeft size={22} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
               onClick={() => navigate('/markets')}>
            <span style={{ fontWeight: 700, fontSize: 17,
                           color: 'var(--color-text)' }}>{baseSym}/USDT</span>
            <ChevronDown size={14} color="var(--color-muted)" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Star size={20} fill={starred ? '#f0b90b' : 'none'}
            color={starred ? '#f0b90b' : 'var(--color-muted)'}
            style={{ cursor: 'pointer' }} onClick={onStarToggle} />
          <RefreshCw size={18} color="var(--color-muted)"
            style={{ cursor: 'pointer' }} onClick={onRefresh} />
          <Bell size={18} color="var(--color-muted)" style={{ cursor: 'pointer' }} />
        </div>
      </div>

      {/* Price + stats */}
      <div style={{ display: 'flex', alignItems: 'flex-start',
                    justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1,
                        color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {currentPrice > 0
              ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })
              : '---'}
          </div>
          <div style={{ fontSize: 13, marginTop: 2,
                        color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
            ≈${currentPrice > 0
              ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })
              : '---'}
            {'  '}{isUp ? '+' : ''}{change24h.toFixed(2)}%
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)',
                      textAlign: 'right', lineHeight: 1.8 }}>
          <div>24h high <span style={{ color: 'var(--color-text)', marginLeft: 6 }}>
            {high24h > 0 ? high24h.toLocaleString() : '---'}
          </span></div>
          <div>24h low{'  '}<span style={{ color: 'var(--color-text)', marginLeft: 6 }}>
            {low24h > 0 ? low24h.toLocaleString() : '---'}
          </span></div>
          <div>24h vol <span style={{ color: 'var(--color-text)', marginLeft: 6 }}>
            {volume24h > 0 ? (volume24h / 1000000).toFixed(2) + 'M' : '---'}
          </span></div>
        </div>
      </div>
    </div>
  );
}
