import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart2, Bell } from 'lucide-react';

interface Props {
  announcement?: any;
}

export default function HeroSection({ announcement }: Props) {
  const navigate = useNavigate();

  return (
    <section className="hero-section" style={{
      background: 'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(240,185,11,0.18), transparent 60%), radial-gradient(ellipse 70% 50% at 90% 30%, rgba(14,203,129,0.10), transparent 60%), linear-gradient(180deg, #0a0d12 0%, #11151d 45%, #0a0d12 100%)',
      position: 'relative', overflow: 'hidden',
      padding: '0 20px',
    }}>
      {/* Large soft glow - left, like reference's "globe glow" depth */}
      <div style={{
        position: 'absolute', top: '5%', left: '-10%',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(240,185,11,0.14) 0%, transparent 65%)',
        pointerEvents: 'none'
      }} />
      {/* Large soft glow - right */}
      <div style={{
        position: 'absolute', bottom: '0%', right: '-10%',
        width: 550, height: 550, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(14,203,129,0.10) 0%, transparent 65%)',
        pointerEvents: 'none'
      }} />
      {/* Subtle grid pattern for premium depth */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.5,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 80%)',
        pointerEvents: 'none'
      }} />
      {/* Scattered "stars" dots for depth, like reference's night-sky feel */}
      <div className="hero-stars" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          radial-gradient(1.5px 1.5px at 20% 15%, rgba(255,255,255,0.5), transparent),
          radial-gradient(1px 1px at 75% 25%, rgba(255,255,255,0.4), transparent),
          radial-gradient(1.5px 1.5px at 40% 60%, rgba(255,255,255,0.3), transparent),
          radial-gradient(1px 1px at 90% 70%, rgba(255,255,255,0.4), transparent),
          radial-gradient(1.5px 1.5px at 10% 80%, rgba(255,255,255,0.3), transparent),
          radial-gradient(1px 1px at 60% 10%, rgba(255,255,255,0.35), transparent)
        `,
      }} />

      <div className="hero-inner" style={{
        maxWidth: 1100, margin: '0 auto',
        display: 'flex', alignItems: 'center',
        gap: 48, minHeight: '88vh',
        padding: '60px 0',
        flexWrap: 'wrap',
        position: 'relative', zIndex: 2,
      }}>

        {/* LEFT: Text content */}
        <div className="hero-text" style={{ flex: '1 1 460px', position: 'relative', zIndex: 2 }}>

          {/* Announcement / Badge */}
          {announcement ? (
            <div className="hero-badge" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '7px 16px', borderRadius: 20,
              background: '#f0b90b18', border: '1px solid #f0b90b44',
              marginBottom: 24, fontSize: 13, color: 'var(--color-primary)',
              cursor: 'pointer', maxWidth: '100%'
            }}>
              <Bell size={13} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {announcement.title}
              </span>
              <ArrowRight size={13} style={{ flexShrink: 0 }} />
            </div>
          ) : (
            <div className="hero-badge" style={{
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
          <h1 className="hero-headline" style={{
            fontSize: 'clamp(34px, 6vw, 58px)',
            fontWeight: 900, lineHeight: 1.12,
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

          <p className="hero-subtext" style={{
            fontSize: 17, color: 'var(--color-muted)',
            maxWidth: 480, marginBottom: 36, lineHeight: 1.7
          }}>
            Buy, sell, and trade 10+ cryptocurrencies with low fees,
            real-time charts, and bank-grade security on VDExchange.
          </p>

          {/* CTA Buttons */}
          <div className="hero-cta-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 48 }}>
            <button onClick={() => navigate('/register')} style={{
              padding: '15px 32px', borderRadius: 12, border: 'none',
              background: 'var(--color-primary)', color: '#000',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 24px rgba(240,185,11,0.35)'
            }}>
              Get Started Free <ArrowRight size={16} />
            </button>
            <button onClick={() => navigate('/markets')} style={{
              padding: '15px 32px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)', color: '#fff',
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              backdropFilter: 'blur(8px)'
            }}>
              <BarChart2 size={16} /> View Markets
            </button>
          </div>

          {/* Stats row */}
          <div className="hero-stats-row" style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {[
              ['10+', 'Cryptocurrencies'],
              ['0.1%', 'Trading Fee'],
              ['24/7', 'Support'],
              ['$6M+', 'Volume'],
            ].map(([val, label]) => (
              <div key={label} className="hero-stat-item">
                <div style={{ fontSize: 22, fontWeight: 800,
                              color: 'var(--color-primary)' }}>{val}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)',
                              marginTop: 2, whiteSpace: 'nowrap' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Hero image / Phone mockup */}
        <div className="hero-visual" style={{
          flex: '1 1 380px', position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 400,
        }}>
          {/* Glow behind image */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(240,185,11,0.16) 0%, transparent 70%)',
            borderRadius: '50%',
          }} />

          {/* Hero image */}
          <img
            src="https://gatbits.com/images/hero_img.svg"
            alt="VDExchange Trading App"
            className="hero-img"
            style={{
              width: '100%', maxWidth: 480,
              height: 'auto', position: 'relative', zIndex: 1,
              filter: 'drop-shadow(0 24px 48px rgba(240,185,11,0.18))',
              animation: 'float 4s ease-in-out infinite',
            }}
            onError={(e: any) => {
              e.target.style.display = 'none';
              const fallback = document.getElementById('hero-fallback');
              if (fallback) fallback.style.display = 'block';
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

        /* ── Mobile premium fix ──
           Compacts the text block significantly (smaller badge, smaller
           headline/paragraph, tighter gaps, smaller stat numbers) so the
           phone-mockup visual gets real room to breathe below it instead
           of being pushed off-screen. */
        @media (max-width: 768px) {
          .hero-section {
            padding: 0 16px !important;
          }
          .hero-inner {
            min-height: auto !important;
            padding: 28px 0 32px !important;
            gap: 20px !important;
            text-align: center;
          }
          .hero-text {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .hero-badge {
            margin-bottom: 14px !important;
            padding: 5px 12px !important;
            font-size: 12px !important;
          }
          .hero-headline {
            font-size: clamp(26px, 7vw, 36px) !important;
            margin-bottom: 10px !important;
            line-height: 1.15 !important;
          }
          .hero-subtext {
            font-size: 14px !important;
            margin-bottom: 18px !important;
            line-height: 1.5 !important;
          }
          .hero-cta-row {
            width: 100%;
            justify-content: center;
            margin-bottom: 20px !important;
            gap: 8px !important;
          }
          .hero-cta-row button {
            flex: 1 1 auto;
            min-width: 140px;
            padding: 11px 20px !important;
            font-size: 14px !important;
          }
          .hero-stats-row {
            justify-content: center;
            gap: 16px !important;
            margin-bottom: 0 !important;
          }
          .hero-stat-item {
            text-align: center;
          }
          .hero-stat-item > div:first-child {
            font-size: 17px !important;
          }
          .hero-stat-item > div:last-child {
            font-size: 10px !important;
          }
          .hero-visual {
            min-height: 0 !important;
            margin-top: 8px;
          }
          .hero-img {
            max-width: 380px !important;
          }
        }

        @media (max-width: 420px) {
          .hero-stats-row {
            gap: 12px !important;
          }
        }
      `}</style>
    </section>
  );
}
