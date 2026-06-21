import { Smartphone } from 'lucide-react';

export default function AppDownloadSection() {
  return (
    <section style={{
      background: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(240,185,11,0.08), transparent), linear-gradient(180deg, #0a0d12 0%, #12161f 50%, #0a0d12 100%)',
      padding: '70px 20px', position: 'relative', overflow: 'hidden'
    }}>
      <div className="appdl-inner" style={{
        maxWidth: 1100, margin: '0 auto',
        display: 'flex', alignItems: 'center', gap: 48,
        flexWrap: 'wrap'
      }}>

        {/* LEFT: Text + QR + Buttons */}
        <div className="appdl-text" style={{ flex: '1 1 380px' }}>
          <h2 className="appdl-h2" style={{
            fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 800,
            color: '#fff', marginBottom: 12, lineHeight: 1.2
          }}>
            Trade Crypto <span style={{ color: 'var(--color-primary)' }}>Anytime, Anywhere</span>
          </h2>
          <p className="appdl-p" style={{ fontSize: 15, color: 'var(--color-muted)', marginBottom: 32, lineHeight: 1.6, maxWidth: 460 }}>
            Welcome to the future of crypto — trade instantly and effortlessly with VDExchange,
            on any device, wherever you are.
          </p>

          <div className="appdl-qr-row" style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
            <div style={{
              width: 130, height: 130, borderRadius: 16, background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, padding: 8, boxSizing: 'border-box'
            }}>
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://exchange.vdscan.io"
                alt="Download QR Code"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                Android
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                Scan to Download
              </div>
            </div>
          </div>

          {/* Buttons - solid white background, black text/icons for contrast */}
          <div className="appdl-buttons-grid" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12
          }}>
            {[
              { logo: 'https://cdn-icons-png.flaticon.com/512/0/747.png', label: 'App Store' },
              { logo: 'https://cdn-icons-png.flaticon.com/512/300/300218.png', label: 'Google Play' },
              { logo: 'https://cdn-icons-png.flaticon.com/512/873/873107.png', label: 'APK' },
            ].map(btn => (
              <button key={btn.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 16px', borderRadius: 30,
                background: '#fff',
                border: 'none',
                color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer'
              }}>
                <img src={btn.logo} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                {btn.label}
              </button>
            ))}
            <button style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 16px', borderRadius: 30,
                background: '#fff', border: 'none',
                color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer'
              }}>
                <Smartphone size={18} /> API Docs
            </button>
          </div>
        </div>

        {/* RIGHT: Real app mockup image */}
        <div className="appdl-visual" style={{
          flex: '1 1 420px', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(240,185,11,0.14) 0%, transparent 70%)',
          }} />
          <img
            src="https://gatbits.com/images/crypto_app_mobile.svg"
            alt="VDExchange App Mockup"
            className="appdl-img"
            style={{
              width: '100%', maxWidth: 480, height: 'auto',
              position: 'relative', zIndex: 1,
              filter: 'drop-shadow(0 24px 48px rgba(240,185,11,0.15))'
            }}
            onError={(e: any) => { e.target.style.display = 'none'; }}
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          section { padding: 32px 16px !important; }

          /* THE FIX: align-items:center was stretching the gap because it
             centers each flex child within the OTHER child's full height.
             flex-start makes both blocks hug the top, eliminating the
             dead space between the buttons and the image below them. */
          .appdl-inner {
            flex-direction: column !important;
            align-items: stretch !important;
            text-align: center;
            gap: 0 !important;
          }
          .appdl-h2 { margin-bottom: 8px !important; }
          .appdl-p { margin-bottom: 16px !important; }
          .appdl-qr-row {
            justify-content: center;
            margin-bottom: 16px !important;
          }
          .appdl-qr-row > div:first-child { width: 92px !important; height: 92px !important; }
          .appdl-buttons-grid {
            width: 100%; max-width: 360px; margin: 0 auto;
          }
          .appdl-buttons-grid button { padding: 10px 12px !important; font-size: 13px !important; }
          .appdl-visual {
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .appdl-img {
            max-width: 100% !important;
            width: 100% !important;
          }
        }
      `}</style>
    </section>
  );
}
