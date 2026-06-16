import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart2, Bell } from 'lucide-react';

interface Props {
  announcement?: any;
}

export default function HeroSection({ announcement }: Props) {
  const navigate = useNavigate();

  return (
    <section style={{
      background: 'linear-gradient(160deg, #0b0e11 0%, #1a1f2e 60%, #0b0e11 100%)',
      position: 'relative', overflow: 'hidden',
      padding: '0 24px',
    }}>
      {/* Background glow left */}
      <div style={{
        position: 'absolute', top: '30%', left: '10%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(240,185,11,0.07) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      {/* Background glow right */}
      <div style={{
        position: 'absolute', top: '10%', right: '5%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(14,203,129,0.05) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: 1100, margin: '0 auto',
        display: 'flex', alignItems: 'center',
        gap: 48, minHeight: '88vh',
        padding: '60px 0',
        flexWrap: 'wrap',
      }}>

        {/* LEFT: Text content */}
        <div style={{ flex: '1 1 460px', position: 'relative', zIndex: 2 }}>

          {/* Announcement / Badge */}
          {announcement ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '7px 16px', borderRadius: 20,
              background: '#f0b90b18', border: '1px solid #f0b90b44',
              marginBottom: 24, fontSize: 13, color: 'var(--color-primary)',
              cursor: 'pointer'
            }}>
              <Bell size={13} />
              {announcement.title}
              <ArrowRight size={13} />
            </div>
          ) : (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '7px 16px', borderRadius: 20,
              background: '#f0b90b18', border: '1px solid #f0b90b44',
              marginBottom: 24, fontSize: 13, color: 'var(--color-primary)'
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#f0b90b', boxShadow: '0 0 8px #f0b90b',
                display: 'inline-block',
                animation: 'pulse 2s infinite'
              }} />
              Live Trading Platform — Real-time prices
            </div>
          )}

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(36px, 5vw, 58px)',
            fontWeight: 900, lineHeight: 1.1,
            color: '#ffffff', marginBottom: 20,
            letterSpacing: '-1.5px'
          }}>
            The Most Efficient<br />
            <span style={{
              background: 'linear-gradient(90deg, #f0b90b, #ffd700)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Crypto Trading
            </span><br />
            Platform
          </h1>

          <p style={{
            fontSize: 17, color: 'var(--color-muted)',
            maxWidth: 480, marginBottom: 36, lineHeight: 1.7
          }}>
            Buy, sell, and trade 10+ cryptocurrencies with low fees,
            real-time charts, and bank-grade security on VDExchange.
          </p>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 48 }}>
            <button onClick={() => navigate('/register')} style={{
              padding: '15px 32px', borderRadius: 12, border: 'none',
              background: 'var(--color-primary)', color: '#000',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 24px rgba(240,185,11,0.35)'
            }}>
              Get Started Free <ArrowRight size={16} />
            </button>
            <button onClick={() => navigate('/markets')} style={{
              padding: '15px 32px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)', color: '#fff',
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              backdropFilter: 'blur(8px)'
            }}>
              <BarChart2 size={16} /> View Markets
            </button>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {[
              ['10+', 'Cryptocurrencies'],
              ['0.1%', 'Trading Fee'],
              ['24/7', 'Support'],
              ['$6M+', 'Volume'],
            ].map(([val, label]) => (
              <div key={label}>
                <div style={{ fontSize: 22, fontWeight: 800,
                              color: 'var(--color-primary)' }}>{val}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)',
                              marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Hero image / Phone mockup */}
        <div style={{
          flex: '1 1 380px', position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 400,
        }}>
          {/* Glow behind image */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(240,185,11,0.12) 0%, transparent 70%)',
            borderRadius: '50%',
          }} />

          {/* Hero image */}
          <img
            src="https://gatbits.com/images/hero_img.svg"
            alt="VDExchange Trading App"
            style={{
              width: '100%', maxWidth: 480,
              height: 'auto', position: 'relative', zIndex: 1,
              filter: 'drop-shadow(0 24px 48px rgba(240,185,11,0.15))',
              animation: 'float 4s ease-in-out infinite',
            }}
            onError={(e: any) => {
              // Fallback: show a styled card if image fails
              e.target.style.display = 'none';
            }}
          />

          {/* Fallback card if image not available */}
          <div style={{
            position: 'relative', zIndex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 24, padding: 24, width: '100%', maxWidth: 360,
            backdropFilter: 'blur(12px)',
            display: 'none',
          }} id="hero-fallback">
            {/* Live price card */}
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%',
                              background: '#f7931a',
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontWeight: 800,
                              color: '#fff', fontSize: 14 }}>B</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff' }}>BTC/USDT</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Bitcoin</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>$66,412</div>
                <div style={{ fontSize: 13, color: '#0ecb81', fontWeight: 600 }}>+1.18%</div>
              </div>
            </div>
            {/* Chart bars */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 60 }}>
              {[40,55,45,70,60,80,65,90,75,85].map((h, i) => (
                <div key={i} style={{
                  flex: 1, height: `${h}%`, borderRadius: 4,
                  background: i > 5 ? '#0ecb81' : 'rgba(255,255,255,0.1)'
                }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </section>
  );
}
