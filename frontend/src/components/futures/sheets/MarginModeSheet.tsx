import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  marginMode: 'cross' | 'isolated';
  positionMode: 'combined' | 'separated';
  onConfirm: (margin: 'cross'|'isolated', pos: 'combined'|'separated') => void;
  onClose: () => void;
}

export default function MarginModeSheet({ marginMode, positionMode, onConfirm, onClose }: Props) {
  const [margin, setMargin]   = useState(marginMode);
  const [posMode, setPosMode] = useState(positionMode);
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
                      background: 'var(--color-border)', margin: '0 auto 20px' }} />
      )}

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
          Adjust margin mode
        </div>
        {desktop && (
          <button onClick={onClose} style={{ background: 'none', border: 'none',
                   cursor: 'pointer', color: 'var(--color-muted)', display: 'flex' }}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Position type */}
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 10 }}>
        Position type
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {(['cross','isolated'] as const).map(m => (
          <button key={m} onClick={() => setMargin(m)} style={{
            padding: '14px', borderRadius: 10, cursor: 'pointer', fontSize: 14,
            fontWeight: 600, position: 'relative',
            border: margin === m ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
            background: margin === m ? 'rgba(240,185,11,0.08)' : 'var(--color-surface2)',
            color: margin === m ? 'var(--color-primary)' : 'var(--color-text)',
          }}>
            {margin === m && (
              <span style={{ position: 'absolute', top: 6, right: 8,
                             fontSize: 10, color: 'var(--color-primary)' }}>v</span>
            )}
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Position mode */}
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 10 }}>
        Position mode
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {(['combined','separated'] as const).map(p => (
          <button key={p} onClick={() => p === 'combined' && setPosMode(p)} style={{
            padding: '14px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: p === 'combined' ? 'pointer' : 'not-allowed', position: 'relative',
            border: posMode === p ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
            background: posMode === p ? 'rgba(240,185,11,0.08)' : 'var(--color-surface2)',
            color: posMode === p ? 'var(--color-primary)' : p === 'separated'
              ? 'var(--color-muted)' : 'var(--color-text)',
            opacity: p === 'separated' ? 0.5 : 1
          }}>
            {posMode === p && (
              <span style={{ position: 'absolute', top: 6, right: 8,
                             fontSize: 10, color: 'var(--color-primary)' }}>v</span>
            )}
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 8 }}>
        i Separated mode not supported for current trading pair.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <div style={{ width: 16, height: 16, borderRadius: 3,
                      border: '1px solid var(--color-border)' }} />
        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Apply to all futures</span>
      </div>

      <button onClick={() => { onConfirm(margin, posMode); onClose(); }} style={{
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
                      width: 480, maxHeight: '80vh', overflow: 'auto',
                      border: '1px solid var(--color-border)',
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
