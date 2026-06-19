import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Share2 } from 'lucide-react';
import { futuresAPI } from '../../services/api';
import { QRCodeSVG } from 'qrcode.react';
import { useStore } from '../../store/useStore';

interface Props {
  data: {
    symbol: string;
    side: 'long' | 'short';
    leverage: number;
    pnl: number;
    roi: number;
    entryPrice: number;
    markPrice: number;
    closedAt?: string;
  };
  onClose: () => void;
}

type SizeMode = 'square' | 'insta';

export default function ShareCardModal({ data, onClose }: Props) {
  const { user } = useStore() as any;
  const cardRef = useRef<HTMLDivElement>(null);
  const [desktop, setDesktop]   = useState(window.innerWidth >= 1024);
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplIdx, setTplIdx]     = useState(0);
  const [size, setSize]         = useState<SizeMode>('square');
  const [show, setShow]         = useState({
    pnlPct: true, pnlUsd: true, entry: true, mark: true, time: true, leverage: true,
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const h = () => setDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    futuresAPI.getShareTemplates().then((res: any) => {
      const list = (res as any)?.data || res || [];
      setTemplates(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  const isLong   = data.side === 'long';
  const pnlColor = data.pnl >= 0 ? '#0ECB81' : '#F6465D';
  const tpl      = templates[tplIdx];
  const siteName = 'VDExchange';
  const refCode  = user?.referral_code || user?.uid || '';

  const dims = size === 'square'
    ? { w: 360, h: 360, label: '1:1' }
    : { w: 360, h: 450, label: '4:5' };

  const cycleTpl = (dir: 1 | -1) => {
    if (templates.length === 0) return;
    setTplIdx(i => (i + dir + templates.length) % templates.length);
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: null });
      const link = document.createElement('a');
      link.download = `${data.symbol}-pnl-share.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch(e) {
      alert('Download failed. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: null });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `${data.symbol}-pnl.png`, { type: 'image/png' });
        if ((navigator as any).share && (navigator as any).canShare?.({ files: [file] })) {
          await (navigator as any).share({ files: [file], title: `${data.symbol} PnL` });
        } else {
          handleDownload();
        }
      });
    } catch(e) {
      handleDownload();
    }
  };

  const fmtMoney = (v: number) => Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const fmtPrice = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const cardContent = (
    <div ref={cardRef} style={{
      width: dims.w, height: dims.h, borderRadius: 16, overflow: 'hidden',
      position: 'relative', background: 'linear-gradient(135deg, #0b0e11 0%, #14181f 100%)',
      fontFamily: 'inherit', display: 'flex', flexDirection: 'column',
      transform: 'translateZ(0)', WebkitMaskImage: '-webkit-radial-gradient(white, black)',
      isolation: 'isolate' as any
    }}>
      {/* Background character image - right half, transparent PNG */}
      {tpl?.image_url && (
        <img src={`/api/v1/futures/image-proxy?url=${encodeURIComponent(tpl.image_url)}`} alt="" crossOrigin="anonymous"
          style={{
            position: 'absolute', right: '-8%', top: '18%',
            width: '70%', height: 'auto', objectFit: 'contain',
            zIndex: 1, pointerEvents: 'none'
          }} />
      )}

      {/* Top bar: logo + referral chip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 18px 0', zIndex: 2, position: 'relative', gap: 8, boxSizing: 'border-box' as any }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#F0B90B', letterSpacing: 0.5, flexShrink: 0 }}>
          ⚡ {siteName}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', padding: '4px 9px',
                       borderRadius: 12, background: 'rgba(255,255,255,0.15)',
                       whiteSpace: 'nowrap', flexShrink: 0, maxWidth: '40%',
                       overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user?.uid || 'trader'}
        </span>
      </div>

      {/* Left data column */}
      <div style={{ padding: '20px 18px 0', zIndex: 2, position: 'relative', maxWidth: '58%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{data.symbol}</span>
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4,
                         background: 'rgba(255,255,255,0.1)', color: '#999' }}>Perp</span>
        </div>
        {show.leverage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13 }}>
            <span style={{ color: isLong ? '#0ECB81' : '#F6465D', fontWeight: 700 }}>
              {isLong ? 'Long' : 'Short'}
            </span>
            <span style={{ color: '#666' }}>|</span>
            <span style={{ color: '#ccc' }}>{data.leverage}x</span>
          </div>
        )}
        {show.pnlPct && (
          <div style={{ fontSize: 34, fontWeight: 800, color: pnlColor, lineHeight: 1.1 }}>
            {data.roi >= 0 ? '+' : ''}{data.roi.toFixed(2)}%
          </div>
        )}
        {show.pnlUsd && (
          <div style={{ fontSize: 17, fontWeight: 700, color: pnlColor, marginTop: 4, marginBottom: 18 }}>
            {data.pnl >= 0 ? '+' : '-'}{fmtMoney(data.pnl)} USDT
          </div>
        )}
        <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.9 }}>
          {show.entry && <div>Entry price: <span style={{ color: '#fff', fontWeight: 600 }}>{fmtPrice(data.entryPrice)}</span></div>}
          {show.mark  && <div>Mark price: <span style={{ color: '#fff', fontWeight: 600 }}>{fmtPrice(data.markPrice)}</span></div>}
          {show.time  && <div>Time shared: <span style={{ color: '#fff', fontWeight: 600 }}>
            {new Date(data.closedAt || Date.now()).toLocaleString('en-GB', { month:'2-digit', day:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
          </span></div>}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Footer bar: QR + referral */}
      <div style={{ background: 'rgba(0,0,0,0.55)', padding: '12px 18px', display: 'flex',
                    alignItems: 'center', gap: 12, zIndex: 2, position: 'relative' }}>
        <div style={{ width: 40, height: 40, background: '#fff', borderRadius: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2 }}>
          <QRCodeSVG value={`https://exchange.vdscan.io/register?ref=${refCode}`} size={36} />
        </div>
        <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.5 }}>
          <div>Referral code: <span style={{ color: '#fff', fontWeight: 700 }}>{refCode}</span></div>
          <div>Join {siteName} and start trading!</div>
        </div>
      </div>
    </div>
  );

  const modalInner = (
    <div style={{ background: 'var(--color-surface)', borderRadius: desktop ? 16 : '16px 16px 0 0',
                  padding: desktop ? 24 : '16px 16px 28px', width: '100%',
                  maxWidth: desktop ? 460 : '100%' }}
      onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Share PnL</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={20} color="var(--color-muted)" />
        </button>
      </div>

      {/* Card preview with arrows */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={() => cycleTpl(-1)} style={{ background: 'var(--color-surface2)', border: 'none',
                 borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex',
                 alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ChevronLeft size={18} color="var(--color-text)" />
        </button>
        <div style={{ overflow: 'hidden', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {cardContent}
        </div>
        <button onClick={() => cycleTpl(1)} style={{ background: 'var(--color-surface2)', border: 'none',
                 borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex',
                 alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ChevronRight size={18} color="var(--color-text)" />
        </button>
      </div>

      {/* Size toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['square','insta'] as SizeMode[]).map(s => (
          <button key={s} onClick={() => setSize(s)} style={{
            flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--color-border)',
            background: size === s ? 'var(--color-primary)' : 'var(--color-surface2)',
            color: size === s ? '#000' : 'var(--color-text)'
          }}>{s === 'square' ? 'Square 1:1' : 'Instagram 4:5'}</button>
        ))}
      </div>

      {/* Field toggles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {([
          ['pnlPct','PnL %'],['pnlUsd','PnL $'],['entry','Entry'],
          ['mark','Mark'],['time','Time'],['leverage','Leverage'],
        ] as [keyof typeof show, string][]).map(([key, label]) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                                     color: 'var(--color-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={show[key]}
              onChange={e => setShow(s => ({ ...s, [key]: e.target.checked }))}
              style={{ accentColor: 'var(--color-primary)' }} />
            {label}
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleDownload} disabled={exporting} style={{
          flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--color-border)',
          background: 'var(--color-surface2)', color: 'var(--color-text)', fontSize: 13, fontWeight: 700,
          cursor: exporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 6
        }}>
          <Download size={15} /> {exporting ? 'Exporting...' : 'Download'}
        </button>
        <button onClick={handleShare} disabled={exporting} style={{
          flex: 1, padding: '12px', borderRadius: 10, border: 'none',
          background: 'var(--color-primary)', color: '#000', fontSize: 13, fontWeight: 700,
          cursor: exporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 6
        }}>
          <Share2 size={15} /> Share
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500,
                  display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center',
                  overflowY: 'auto' }}
      onClick={onClose}>
      {modalInner}
    </div>
  );
}
