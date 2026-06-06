import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Calendar, Info } from 'lucide-react';
import { marketAPI } from '../../services/api';

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!targetDate) return;
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Trading Started!'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000).toString().padStart(2,'0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2,'0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2,'0');
      setTimeLeft(`${String(d).padStart(2,'0')}D ${h}:${m}:${s}`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [targetDate]);
  return timeLeft;
}

export default function ListingDetail() {
  const { symbol } = useParams();
  const navigate   = useNavigate();
  const [pair, setPair] = useState<any>(null);
  const countdown  = useCountdown(pair?.listing_date || null);

  useEffect(() => {
    marketAPI.getPairs().then((res: any) => {
      const found = res.data.find((p: any) => p.symbol === symbol?.toUpperCase());
      if (found) setPair(found);
    });
  }, [symbol]);

  if (!pair) return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--color-muted)' }}>Loading...</div>
    </div>
  );

  const listingDate = pair.listing_date
    ? new Date(pair.listing_date).toLocaleString()
    : 'TBA';

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', borderBottom: '1px solid var(--color-border)',
                    position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10 }}>
        <ArrowLeft size={20} color="var(--color-text)" style={{ cursor: 'pointer' }}
          onClick={() => navigate(-1)} />
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
          New Listing
        </span>
      </div>

      {/* Token hero */}
      <div style={{ padding: '24px 16px', textAlign: 'center',
                    borderBottom: '1px solid var(--color-border)' }}>
        {pair.base_logo
          ? <img src={pair.base_logo} alt=""
              style={{ width: 72, height: 72, borderRadius: '50%', marginBottom: 12 }} />
          : <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 12px',
                          background: 'var(--color-surface2)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, color: 'var(--color-primary)', fontSize: 28 }}>
              {pair.base_symbol?.charAt(0)}
            </div>
        }
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)' }}>
          {pair.base_symbol}<span style={{ color: 'var(--color-muted)', fontWeight: 400,
                                           fontSize: 16 }}>/USDT</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4 }}>
          {pair.base_name || pair.base_symbol}
        </div>

        {/* Countdown big */}
        {pair.pre_listing_mode && (
          <div style={{ marginTop: 20, background: 'var(--color-surface)',
                        borderRadius: 16, padding: '16px 24px',
                        border: '1px solid var(--color-border)', display: 'inline-block' }}>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 6 }}>
              Trading starts in
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary)',
                          letterSpacing: 2 }}>
              {countdown}
            </div>
          </div>
        )}
      </div>

      {/* Info cards */}
      <div style={{ padding: '16px' }}>

        {/* Listing date */}
        <div style={{ background: 'var(--color-surface)', borderRadius: 12,
                      padding: '14px 16px', marginBottom: 12,
                      border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Calendar size={16} color="var(--color-primary)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
              Listing Date
            </span>
          </div>
          <div style={{ fontSize: 15, color: 'var(--color-text)', fontWeight: 600 }}>
            {listingDate}
          </div>
        </div>

        {/* Trading status */}
        <div style={{ background: 'var(--color-surface)', borderRadius: 12,
                      padding: '14px 16px', marginBottom: 12,
                      border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Clock size={16} color="var(--color-primary)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
              Status
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Spot Trading',  ok: pair.is_active },
              { label: 'Deposit',       ok: false },
              { label: 'Withdrawal',    ok: false },
            ].map(({ label, ok }) => (
              <div key={label} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: ok ? 'rgba(14,203,129,0.12)' : 'rgba(246,70,93,0.10)',
                color: ok ? 'var(--color-success)' : 'var(--color-danger)',
                border: `1px solid ${ok ? 'rgba(14,203,129,0.2)' : 'rgba(246,70,93,0.2)'}`,
              }}>
                {ok ? '✓' : '✗'} {label}
              </div>
            ))}
          </div>
        </div>

        {/* Notice */}
        {pair.trading_notice && (
          <div style={{ background: 'rgba(255,193,7,0.08)', borderRadius: 12,
                        padding: '14px 16px', marginBottom: 12,
                        border: '1px solid rgba(255,193,7,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Info size={16} color="#ffc107" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#ffc107' }}>Notice</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5 }}>
              {pair.trading_notice}
            </div>
          </div>
        )}

        {/* Coming soon banner */}
        <div style={{ background: 'linear-gradient(135deg, rgba(255,193,7,0.15), rgba(255,152,0,0.1))',
                      borderRadius: 12, padding: '16px', textAlign: 'center',
                      border: '1px solid rgba(255,193,7,0.2)', marginTop: 8 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)',
                        marginBottom: 6 }}>Trading Coming Soon!</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            {pair.base_symbol}/USDT spot trading will be available on {listingDate}.
            Stay tuned for the launch!
          </div>
        </div>
      </div>
    </div>
  );
}
