import { useNavigate } from 'react-router-dom';
import { ChevronDown, CandlestickChart, Bell, MoreHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
  sym: string;
  baseSym: string;
  currentPrice: number;
  change24h: number;
  isUp: boolean;
  fundingRate?: number;
}

export default function FuturesHeader({ sym, baseSym, currentPrice, change24h, isUp, fundingRate = -0.005822 }: Props) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const calcCountdown = () => {
      const now = new Date();
      const next = new Date();
      const h = now.getUTCHours();
      const nextH = h < 8 ? 8 : h < 16 ? 16 : 24;
      next.setUTCHours(nextH, 0, 0, 0);
      const diff = next.getTime() - now.getTime();
      const hh = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const mm = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const ss = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setCountdown(`${hh}:${mm}:${ss}`);
    };
    calcCountdown();
    const t = setInterval(calcCountdown, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ background: 'var(--color-surface)', flexShrink: 0,
                  padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left: Symbol */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
             onClick={() => navigate('/markets')}>
          <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
            {baseSym}
          </span>
          <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>/USDT</span>
          <ChevronDown size={14} color="var(--color-muted)" />
          <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4,
                         background: 'rgba(255,255,255,0.08)', color: 'var(--color-muted)' }}>
            Perp
          </span>
          <span style={{ fontSize: 12, fontWeight: 600,
                         color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {isUp ? '+' : ''}{change24h.toFixed(2)}%
          </span>
        </div>

        {/* Right: Icons */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <CandlestickChart size={20} color="var(--color-muted)" style={{ cursor: 'pointer' }}
            onClick={() => navigate('/chart/' + sym)} />
          <Bell size={20} color="var(--color-muted)" style={{ cursor: 'pointer' }} />
          <MoreHorizontal size={20} color="var(--color-muted)" style={{ cursor: 'pointer' }} />
        </div>
      </div>

      {/* Funding Rate */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 700,
                       color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {currentPrice > 0
            ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })
            : '---'}
        </span>
        <div style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.6 }}>
          <div>Funding rate / Countdown</div>
          <div style={{ color: fundingRate < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
            {(fundingRate).toFixed(6)}% / {countdown}
          </div>
        </div>
      </div>
    </div>
  );
}
