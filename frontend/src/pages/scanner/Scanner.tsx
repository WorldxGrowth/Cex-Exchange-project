import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, QrCode, AlertCircle } from 'lucide-react';

export default function Scanner() {
  const navigate    = useNavigate();
  const scannerRef  = useRef<any>(null);
  const divRef      = useRef<HTMLDivElement>(null);
  const [error, setError]   = useState('');
  const [scanned, setScanned] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let scanner: any = null;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText: string) => {
            setScanned(decodedText);
            scanner.stop().catch(() => {});
          },
          () => {}
        );
        setStarted(true);
      } catch (err: any) {
        if (err?.message?.includes('Permission')) {
          setError('Camera permission denied. Please allow camera access.');
        } else {
          setError('Camera not available on this device.');
        }
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(scanned).catch(() => {});
    navigate(-1);
  };

  return (
    <div style={{
      background: '#000', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 20
    }}>
      {/* Close */}
      <button onClick={() => navigate(-1)} style={{
        position: 'fixed', top: 16, right: 16, zIndex: 100,
        width: 40, height: 40, borderRadius: '50%',
        background: 'rgba(255,255,255,0.15)', border: 'none',
        cursor: 'pointer', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <X size={20} />
      </button>

      <div style={{ color: '#fff', fontSize: 18, fontWeight: 700,
                    marginBottom: 24 }}>Scan QR Code</div>

      {/* QR Scanner div */}
      {!scanned && !error && (
        <div style={{ position: 'relative', width: 280, height: 280,
                      borderRadius: 16, overflow: 'hidden',
                      border: '2px solid var(--color-primary)' }}>
          <div id="qr-reader" ref={divRef}
            style={{ width: '100%', height: '100%' }} />

          {!started && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexDirection: 'column', gap: 8
            }}>
              <div style={{ color: '#fff', fontSize: 13 }}>Starting camera...</div>
            </div>
          )}

          {/* Corner borders */}
          {[
            { top: 0, left: 0, borderTop: '3px solid #f0b90b', borderLeft: '3px solid #f0b90b' },
            { top: 0, right: 0, borderTop: '3px solid #f0b90b', borderRight: '3px solid #f0b90b' },
            { bottom: 0, left: 0, borderBottom: '3px solid #f0b90b', borderLeft: '3px solid #f0b90b' },
            { bottom: 0, right: 0, borderBottom: '3px solid #f0b90b', borderRight: '3px solid #f0b90b' },
          ].map((s, i) => (
            <div key={i} style={{
              position: 'absolute', width: 24, height: 24,
              zIndex: 10, ...s
            }} />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <AlertCircle size={48} color="#f6465d"
            style={{ marginBottom: 12 }} />
          <div style={{ color: '#f6465d', fontSize: 14,
                        marginBottom: 8 }}>{error}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12,
                        lineHeight: 1.5 }}>
            Please enable camera permission in your browser settings
          </div>
        </div>
      )}

      {/* Scanned result */}
      {scanned && (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 320 }}>
          <div style={{ color: '#0ecb81', fontSize: 16, fontWeight: 700,
                        marginBottom: 12 }}>✅ QR Code Scanned!</div>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '12px 16px',
            color: '#fff', fontSize: 13, wordBreak: 'break-all',
            marginBottom: 20, lineHeight: 1.5
          }}>
            {scanned}
          </div>
          <button onClick={handleCopy} style={{
            width: '100%', padding: 14, borderRadius: 12,
            background: 'var(--color-primary)', border: 'none',
            color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            marginBottom: 10
          }}>
            Use This Address
          </button>
          <button onClick={() => setScanned('')} style={{
            width: '100%', padding: 14, borderRadius: 12,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14
          }}>
            Scan Again
          </button>
        </div>
      )}

      {!scanned && !error && (
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13,
                      textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
          Point camera at a wallet address QR code
        </div>
      )}

      {/* Manual */}
      {!scanned && (
        <div style={{ marginTop: 24, width: '100%', maxWidth: 320 }}>
          <button onClick={() => navigate(-1)} style={{
            width: '100%', padding: 14, borderRadius: 12,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontWeight: 600, cursor: 'pointer',
            fontSize: 14, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8
          }}>
            <QrCode size={18} /> Enter Address Manually
          </button>
        </div>
      )}
    </div>
  );
}
