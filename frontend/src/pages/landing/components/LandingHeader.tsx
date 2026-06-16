import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Menu, X } from 'lucide-react';

export default function LandingHeader() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(11,14,17,0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--color-border)',
      padding: '0 20px', height: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
    }}>

      {/* LEFT: Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        onClick={() => navigate('/')}>
        <div style={{ width: 34, height: 34, borderRadius: 10,
                      background: 'var(--color-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0 }}>
          <Zap size={20} color="#000" />
        </div>
        <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-text)',
                       whiteSpace: 'nowrap' }}>
          VDExchange
        </span>
      </div>

      {/* CENTER: Desktop nav links */}
      <nav style={{ display: 'flex', gap: 28, alignItems: 'center',
                    position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}
        className="desktop-only">
        <style>{`
          @media (max-width: 767px) { .desktop-only { display: none !important; } }
          @media (min-width: 768px) { .mobile-only { display: none !important; } }
        `}</style>
        {[['Markets', '/markets'], ['Trade', '/trade'], ['Futures', '/futures']].map(([label, path]) => (
          <a key={label} href={path}
            style={{ color: 'var(--color-muted)', fontSize: 14, fontWeight: 500,
                     textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-muted)')}>
            {label}
          </a>
        ))}
      </nav>

      {/* RIGHT: Buttons + Mobile menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

        {/* Desktop: Log In + Sign Up */}
        <div className="desktop-only" style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/login')} style={{
            padding: '8px 18px', borderRadius: 8,
            background: 'none', border: '1px solid var(--color-border)',
            color: 'var(--color-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer'
          }}>Log In</button>
          <button onClick={() => navigate('/register')} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none',
            background: 'var(--color-primary)', color: '#000',
            fontSize: 14, fontWeight: 700, cursor: 'pointer'
          }}>Sign Up</button>
        </div>

        {/* Mobile: Log In + Sign Up + Menu */}
        <div className="mobile-only" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => navigate('/login')} style={{
            padding: '7px 14px', borderRadius: 8,
            background: 'none', border: '1px solid var(--color-border)',
            color: 'var(--color-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>Log In</button>
          <button onClick={() => navigate('/register')} style={{
            padding: '7px 14px', borderRadius: 8, border: 'none',
            background: 'var(--color-primary)', color: '#000',
            fontSize: 13, fontWeight: 700, cursor: 'pointer'
          }}>Sign Up</button>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text)', display: 'flex', padding: 4
          }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="mobile-only" style={{
          position: 'absolute', top: 60, left: 0, right: 0,
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: '8px 0', zIndex: 200
        }}>
          {[['Markets', '/markets'], ['Trade', '/trade'],
            ['Futures', '/futures']].map(([label, path]) => (
            <a key={label} href={path}
              onClick={() => setMenuOpen(false)}
              style={{ display: 'block', padding: '14px 24px',
                       color: 'var(--color-text)', textDecoration: 'none',
                       fontSize: 15, fontWeight: 500,
                       borderBottom: '1px solid var(--color-border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
