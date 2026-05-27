import { useNavigate } from 'react-router-dom';
import { X, Camera, QrCode } from 'lucide-react';

export default function Scanner() {
  const navigate = useNavigate();

  return (
    <div style={{ background: '#000', minHeight: '100vh', display: 'flex',
                  flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {/* Close */}
      <button onClick={() => navigate(-1)} style={{
        position: 'fixed', top: 16, right: 16, zIndex: 100,
        width: 40, height: 40, borderRadius: '50%',
        background: 'rgba(255,255,255,0.15)', border: 'none',
        cursor: 'pointer', color: '#fff', display: 'flex',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <X size={20} />
      </button>

      {/* Scanner frame */}
      <div style={{ position: 'relative', width: 260, height: 260, marginBottom: 32 }}>
        {/* Corner borders */}
        {[
          { top: 0, left: 0, borderTop: '3px solid var(--color-primary)', borderLeft: '3px solid var(--color-primary)' },
          { top: 0, right: 0, borderTop: '3px solid var(--color-primary)', borderRight: '3px solid var(--color-primary)' },
          { bottom: 0, left: 0, borderBottom: '3px solid var(--color-primary)', borderLeft: '3px solid var(--color-primary)' },
          { bottom: 0, right: 0, borderBottom: '3px solid var(--color-primary)', borderRight: '3px solid var(--color-primary)' },
        ].map((style, i) => (
          <div key={i} style={{ position: 'absolute', width: 30, height: 30, ...style }} />
        ))}

        {/* Scan line animation */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 2,
          background: 'var(--color-primary)', opacity: 0.8,
          animation: 'scan 2s linear infinite',
          boxShadow: '0 0 8px var(--color-primary)'
        }} />

        {/* Camera placeholder */}
        <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: 12 }}>
          <Camera size={48} color="rgba(255,255,255,0.3)" />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Camera not available</span>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0; }
          50% { top: calc(100% - 2px); }
          100% { top: 0; }
        }
      `}</style>

      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
        Scan QR Code
      </div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center',
                    maxWidth: 240, lineHeight: 1.5 }}>
        Point camera at a wallet address QR code to auto-fill deposit address
      </div>

      {/* Manual input */}
      <div style={{ marginTop: 32, width: '80%' }}>
        <button onClick={() => navigate(-1)} style={{
          width: '100%', padding: 14, borderRadius: 12,
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
          <QrCode size={18} /> Enter Address Manually
        </button>
      </div>
    </div>
  );
}
