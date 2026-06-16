import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap } from 'lucide-react';

export default function CTASection() {
  const navigate = useNavigate();
  return (
    <section style={{
      padding: '64px 24px',
      background: 'linear-gradient(135deg, #1a1f2e 0%, #0b0e11 100%)',
      textAlign: 'center', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(240,185,11,0.06) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '6px 16px', borderRadius: 20,
                      background: '#f0b90b18', border: '1px solid #f0b90b33',
                      marginBottom: 20, fontSize: 13, color: 'var(--color-primary)' }}>
          <Zap size={13} /> Join thousands of traders
        </div>

        <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800,
                     marginBottom: 14, color: '#fff' }}>
          Ready to Start Trading?
        </h2>
        <p style={{ color: 'var(--color-muted)', fontSize: 16,
                    marginBottom: 32, maxWidth: 440, margin: '0 auto 32px' }}>
          Join VDExchange and trade your favorite cryptocurrencies
          with low fees and top security.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/register')} style={{
            padding: '16px 36px', borderRadius: 12, border: 'none',
            background: 'var(--color-primary)', color: '#000',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 24px rgba(240,185,11,0.25)'
          }}>
            Get Started <ArrowRight size={16} />
          </button>
          <button onClick={() => navigate('/markets')} style={{
            padding: '16px 36px', borderRadius: 12,
            border: '1px solid var(--color-border)',
            background: 'rgba(255,255,255,0.05)', color: '#fff',
            fontSize: 16, fontWeight: 600, cursor: 'pointer'
          }}>
            View Markets
          </button>
        </div>
      </div>
    </section>
  );
}
