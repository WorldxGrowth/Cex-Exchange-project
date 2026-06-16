import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  leverage: number;
  onConfirm: (lev: number) => void;
  onClose: () => void;
}

export default function LeverageSheet({ leverage, onConfirm, onClose }: Props) {
  const [lev, setLev]     = useState(leverage);
  const [side, setSide]   = useState<'long'|'short'>('long');
  const [desktop, setDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const h = () => setDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const content = (
    <div style={{ padding: desktop ? '24px' : '20px 16px 32px' }}>
      {/* Handle (mobile only) */}
      {!desktop && (
        <div style={{ width: 40, height: 4, borderRadius: 2,
                      background: 'var(--color-border)', margin: '0 auto 16px' }} />
      )}

      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
          Adjust leverage
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-muted)', display: 'flex' }}>
          <X size={20} />
        </button>
      </div>

      {/* Long/Short toggle */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                    background: 'var(--color-surface2)', borderRadius: 10,
                    padding: 4, marginBottom: 20 }}>
        {(['long','short'] as const).map(s => (
          <button key={s} onClick={() => setSide(s)} style={{
            padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: side === s ? 'var(--color-bg)' : 'transparent',
            color: side === s ? 'var(--color-text)' : 'var(--color-muted)',
            fontWeight: side === s ? 700 : 400, fontSize: 14
          }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
        ))}
      </div>

      {/* +/- */}
      <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 56px',
                    gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <button onClick={() => setLev(Math.max(1, lev - 1))} style={{
          padding: '14px', borderRadius: 10, border: '1px solid var(--color-border)',
          background: 'var(--color-surface2)', color: 'var(--color-text)',
          fontSize: 22, cursor: 'pointer', fontWeight: 700
        }}>-</button>
        <div style={{ textAlign: 'center', fontSize: 28, fontWeight: 700,
                      color: 'var(--color-text)' }}>{lev}x</div>
        <button onClick={() => setLev(Math.min(100, lev + 1))} style={{
          padding: '14px', borderRadius: 10, border: '1px solid var(--color-border)',
          background: 'var(--color-surface2)', color: 'var(--color-text)',
          fontSize: 22, cursor: 'pointer', fontWeight: 700
        }}>+</button>
      </div>

      {/* Slider */}
      <input type="range" min={1} max={100} value={lev}
        onChange={e => setLev(parseInt(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--color-primary)', marginBottom: 4 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: 11, color: 'var(--color-muted)', marginBottom: 16 }}>
        {[1, 5, 10, 20, 50, 100].map(v => (
          <span key={v} onClick={() => setLev(v)} style={{
            cursor: 'pointer',
            color: lev === v ? 'var(--color-primary)' : 'var(--color-muted)',
            fontWeight: lev === v ? 700 : 400
          }}>{v}x</span>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: 12, marginBottom: 20 }}>
        <span style={{ color: 'var(--color-muted)' }}>Max. position after adjustment</span>
        <span style={{ color: 'var(--color-text)' }}>0.0000 USDT</span>
      </div>

      <button onClick={() => { onConfirm(lev); onClose(); }} style={{
        width: '100%', padding: '14px', borderRadius: 12, border: 'none',
        background: 'var(--color-primary)', color: '#000',
        fontWeight: 700, cursor: 'pointer', fontSize: 15
      }}>Confirm</button>
    </div>
  );

  if (desktop) {
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 999 }} />
        <div style={{ position: 'fixed', top: '50%', left: '50%',
                      transform: 'translate(-50%,-50%)', zIndex: 1000,
                      background: 'var(--color-surface)', borderRadius: 20,
                      width: 480, border: '1px solid var(--color-border)',
                      boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
          {content}
        </div>
      </>
    );
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)', zIndex: 999 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
                    background: 'var(--color-surface)', borderRadius: '16px 16px 0 0' }}>
        {content}
      </div>
    </>
  );
}
