import { useNavigate } from 'react-router-dom';
import { CandlestickChart, Bell, MoreHorizontal, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
  sym: string;
  baseSym: string;
  currentPrice: number;
  change24h: number;
  isUp: boolean;
  fundingRate?: number;
  onCopyTrade: () => void;
}

export default function FuturesHeader({
  sym, baseSym, currentPrice, change24h, isUp,
  fundingRate = -0.005822, onCopyTrade
}: Props) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState('');
  const [activeTab, setActiveTab] = useState('futures');

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const h = now.getUTCHours();
      const nextH = h < 8 ? 8 : h < 16 ? 16 : 24;
      const next = new Date();
      next.setUTCHours(nextH, 0, 0, 0);
      const diff = next.getTime() - now.getTime();
      const hh = Math.floor(diff / 3600000).toString().padStart(2,'0');
      const mm = Math.floor((diff % 3600000) / 60000).toString().padStart(2,'0');
      const ss = Math.floor((diff % 60000) / 1000).toString().padStart(2,'0');
      setCountdown(`${hh}:${mm}:${ss}`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ background: 'var(--color-bg)', flexShrink: 0,
                  borderBottom: '1px solid var(--color-border)',
                  position: 'sticky', top: 0, zIndex: 50 }}>

      {/* Top tabs: Futures | TradFi | Copy trade */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px',
                    borderBottom: '1px solid var(--color-border)' }}>
        {[
          { key: 'futures',   label: 'Futures',     icon: '' },
          { key: 'tradfi',    label: 'TradFi',      icon: '🔥' },
          { key: 'copytrade', label: 'Copy trade',  icon: '🔥' },
        ].map(tab => (
          <button key={tab.key} onClick={() => {
            if (tab.key === 'copytrade') { onCopyTrade(); return; }
            setActiveTab(tab.key);
          }} style={{
            padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: activeTab === tab.key ? 700 : 400,
            color: activeTab === tab.key ? 'var(--color-text)' : 'var(--color-muted)',
            borderBottom: activeTab === tab.key
              ? '2px solid var(--color-primary)' : '2px solid transparent',
            whiteSpace: 'nowrap'
          }}>
            {tab.label}{tab.icon && (
              <span style={{ marginLeft: 2, fontSize: 12 }}>{tab.icon}</span>
            )}
          </button>
        ))}
      </div>

      {/* Symbol row */}
      <div style={{ display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '8px 12px 10px' }}>
        {/* Left: Symbol */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
             onClick={() => navigate('/markets')}>
          <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--color-text)' }}>
            {baseSym}
          </span>
          <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>/USDT</span>
          <ChevronDown size={14} color="var(--color-muted)" />
          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4,
                         background: 'rgba(255,255,255,0.08)',
                         color: 'var(--color-muted)', marginLeft: 2 }}>Perp</span>
          <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 2,
                         color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {isUp ? '+' : ''}{change24h.toFixed(2)}%
          </span>
        </div>

        {/* Right: Icons */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <CandlestickChart size={20} color="var(--color-muted)" style={{ cursor: 'pointer' }}
            onClick={() => navigate('/chart/' + sym)} />
          <Bell size={20} color="var(--color-muted)" style={{ cursor: 'pointer' }} />
          <MoreHorizontal size={20} color="var(--color-muted)" style={{ cursor: 'pointer' }} />
        </div>
      </div>

    </div>
  );
}
