import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../../services/api';
import {
  ArrowLeft, CheckCircle, Clock, XCircle,
  Camera, Upload, X, Shield, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Compress image before upload ──────────────────
const compressImage = (base64: string, maxSizeKB = 500): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas  = document.createElement('canvas');
      let { width, height } = img;
      const maxDim  = 1200;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = (height / width) * maxDim; width = maxDim; }
        else { width = (width / height) * maxDim; height = maxDim; }
      }
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      let quality = 0.8;
      let result  = canvas.toDataURL('image/jpeg', quality);
      while (result.length > maxSizeKB * 1024 * 1.37 && quality > 0.3) {
        quality -= 0.1;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(result);
    };
    img.src = base64;
  });
};

// ── SVG Placeholders ──────────────────────────────
const DOC_SVG: Record<string, { front: string; back: string; hasBack: boolean }> = {
  passport: {
    hasBack: false,
    front: `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="200" rx="12" fill="#1e2026" stroke="#f0b90b" stroke-width="1.5"/><rect x="20" y="20" width="80" height="100" rx="6" fill="#2b2f36"/><circle cx="60" cy="60" r="22" fill="#3d4149"/><rect x="30" y="90" width="60" height="6" rx="3" fill="#3d4149"/><rect x="120" y="30" width="160" height="8" rx="4" fill="#3d4149"/><rect x="120" y="50" width="120" height="6" rx="3" fill="#2b2f36"/><rect x="120" y="66" width="140" height="6" rx="3" fill="#2b2f36"/><rect x="20" y="140" width="280" height="8" rx="4" fill="#2b2f36"/><rect x="20" y="158" width="280" height="8" rx="4" fill="#2b2f36"/><text x="160" y="192" fill="#f0b90b44" font-size="10" text-anchor="middle" font-family="monospace">TAP TO UPLOAD PASSPORT</text></svg>`,
    back: `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="200" rx="12" fill="#1e2026" stroke="#f0b90b" stroke-width="1.5"/><rect x="20" y="20" width="280" height="40" rx="4" fill="#2b2f36"/><rect x="20" y="75" width="280" height="8" rx="4" fill="#2b2f36"/><text x="160" y="192" fill="#f0b90b44" font-size="10" text-anchor="middle" font-family="monospace">TAP TO UPLOAD BACK</text></svg>`
  },
  driving_license: {
    hasBack: true,
    front: `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="200" rx="12" fill="#1e2026" stroke="#0ecb81" stroke-width="1.5"/><rect x="20" y="20" width="75" height="90" rx="6" fill="#2b2f36"/><circle cx="57" cy="58" r="20" fill="#3d4149"/><rect x="110" y="25" width="100" height="7" rx="3" fill="#3d4149"/><rect x="110" y="42" width="160" height="6" rx="3" fill="#2b2f36"/><rect x="200" y="125" width="100" height="50" rx="6" fill="#2b2f36"/><text x="160" y="192" fill="#0ecb8144" font-size="10" text-anchor="middle" font-family="monospace">TAP TO UPLOAD FRONT</text></svg>`,
    back: `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="200" rx="12" fill="#1e2026" stroke="#0ecb81" stroke-width="1.5"/><rect x="20" y="20" width="280" height="8" rx="4" fill="#2b2f36"/><rect x="20" y="40" width="220" height="6" rx="3" fill="#2b2f36"/><rect x="20" y="60" width="200" height="6" rx="3" fill="#2b2f36"/><text x="160" y="192" fill="#0ecb8144" font-size="10" text-anchor="middle" font-family="monospace">TAP TO UPLOAD BACK</text></svg>`
  },
  national_id: {
    hasBack: true,
    front: `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="200" rx="12" fill="#1e2026" stroke="#1890ff" stroke-width="1.5"/><rect x="20" y="15" width="280" height="20" rx="4" fill="#1890ff22"/><text x="160" y="29" fill="#1890ff88" font-size="10" text-anchor="middle" font-family="sans-serif">GOVERNMENT ID</text><rect x="20" y="50" width="80" height="95" rx="6" fill="#2b2f36"/><circle cx="60" cy="85" r="22" fill="#3d4149"/><rect x="120" y="55" width="150" height="7" rx="3" fill="#3d4149"/><rect x="120" y="73" width="130" height="6" rx="3" fill="#2b2f36"/><rect x="20" y="162" width="280" height="6" rx="3" fill="#2b2f36"/><text x="160" y="192" fill="#1890ff44" font-size="10" text-anchor="middle" font-family="monospace">TAP TO UPLOAD FRONT</text></svg>`,
    back: `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="200" rx="12" fill="#1e2026" stroke="#1890ff" stroke-width="1.5"/><rect x="20" y="20" width="280" height="30" rx="4" fill="#2b2f36"/><rect x="20" y="65" width="200" height="6" rx="3" fill="#2b2f36"/><rect x="20" y="83" width="240" height="6" rx="3" fill="#2b2f36"/><rect x="20" y="130" width="280" height="30" rx="4" fill="#2b2f36"/><text x="160" y="192" fill="#1890ff44" font-size="10" text-anchor="middle" font-family="monospace">TAP TO UPLOAD BACK</text></svg>`
  }
};

// ── Image Upload ──────────────────────────────────
const ImageUpload = ({ label, value, onChange, isSelfie = false, docType = 'national_id', side = 'front' }: any) => {
  const fileRef   = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview]   = useState(value || '');
  const [showOpts, setShowOpts] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast.error('Max 15MB'); return; }
    setCompressing(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const raw        = reader.result as string;
        const compressed = await compressImage(raw, 400);
        setPreview(compressed);
        onChange(compressed);
        setShowOpts(false);
        setCompressing(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setCompressing(false);
      toast.error('Failed to process image');
    }
  };

  const placeholder = DOC_SVG[docType]?.[side as 'front'|'back'] || DOC_SVG.national_id.front;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 8, fontWeight: 500 }}>
        {label}
      </div>

      {compressing ? (
        <div style={{ padding: '32px', borderRadius: 12, border: '1px solid var(--color-border)',
                      background: 'var(--color-surface2)', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>Compressing image...</div>
        </div>
      ) : preview ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden',
                      border: '2px solid var(--color-success)' }}>
          <img src={preview} alt="preview"
            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
          <button onClick={() => { setPreview(''); onChange(''); }}
            style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28,
                     borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none',
                     cursor: 'pointer', color: '#fff', display: 'flex',
                     alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
          <div style={{ padding: '8px', background: '#0ecb8120', fontSize: 12,
                        color: 'var(--color-success)', textAlign: 'center', fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <CheckCircle size={13} color="var(--color-success)" /> Photo ready
          </div>
        </div>
      ) : (
        <div onClick={() => setShowOpts(true)} style={{ cursor: 'pointer', position: 'relative' }}>
          <div dangerouslySetInnerHTML={{ __html: placeholder }}
            style={{ width: '100%', borderRadius: 12, overflow: 'hidden', display: 'block' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 12,
                        background: 'rgba(0,0,0,0.45)', display: 'flex',
                        flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%',
                          background: 'var(--color-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={22} color="#000" />
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Tap to upload</span>
          </div>
        </div>
      )}

      {showOpts && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999,
                      background: 'rgba(0,0,0,0.6)',
                      display: 'flex', flexDirection: 'column',
                      justifyContent: 'flex-end' }}
          onClick={() => setShowOpts(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-surface)',
            borderRadius: '20px 20px 0 0',
            padding: '20px 20px 40px'
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2,
                          background: 'var(--color-border)',
                          margin: '0 auto 16px' }} />
            <div style={{ fontWeight: 700, fontSize: 16,
                          textAlign: 'center', marginBottom: 20 }}>
              {isSelfie ? 'Take Selfie' : 'Upload Photo'}
            </div>

            {!isSelfie && (
              <>
                <button onClick={() => fileRef.current?.click()} style={{
                  width: '100%', padding: 16, borderRadius: 12, marginBottom: 12,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface2)',
                  color: 'var(--color-text)', fontSize: 15, fontWeight: 600,
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 10
                }}>
                  <Upload size={20} color="var(--color-primary)" />
                  Upload from Gallery
                </button>
                <input ref={fileRef} type="file" accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </>
            )}

            <button onClick={() => cameraRef.current?.click()} style={{
              width: '100%', padding: 16, borderRadius: 12, marginBottom: 12,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface2)',
              color: 'var(--color-text)', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 10
            }}>
              <Camera size={20} color="var(--color-primary)" />
              {isSelfie ? 'Front Camera Selfie' : 'Capture with Camera'}
            </button>
            <input ref={cameraRef} type="file" accept="image/*"
              capture={isSelfie ? 'user' : 'environment'}
              style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

            <button onClick={() => setShowOpts(false)} style={{
              width: '100%', padding: 14, borderRadius: 12,
              border: 'none', background: 'none',
              color: 'var(--color-muted)', fontSize: 14, cursor: 'pointer'
            }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Step Bar ──────────────────────────────────────
const StepBar = ({ current, total }: any) => (
  <div style={{ display: 'flex', gap: 6, padding: '14px 20px 0' }}>
    {Array.from({ length: total }, (_, i) => (
      <div key={i} style={{
        flex: 1, height: 4, borderRadius: 2,
        background: i < current ? 'var(--color-primary)' : 'var(--color-border)',
        transition: 'background 0.3s'
      }} />
    ))}
  </div>
);

// ── Submission Progress Screen ────────────────────
// success = true only after real API response
const SubmissionScreen = ({ success, onDone }: any) => {
  const [progress, setProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  // Fake progress goes to 90% — stops there until success=true
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) { clearInterval(timer); return 90; }
        return prev + Math.random() * 12;
      });
    }, 400);
    return () => clearInterval(timer);
  }, []);

  // When real success comes → jump to 100% then show success screen
  useEffect(() => {
    if (success) {
      setProgress(100);
      setTimeout(() => setShowSuccess(true), 800);
    }
  }, [success]);

  // Animated checkmark SVG
  const CheckAnim = () => (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="36" fill="#0ecb81" />
      <polyline points="22,42 34,54 58,28"
        fill="none" stroke="#fff" strokeWidth="5"
        strokeLinecap="round" strokeLinejoin="round"
        style={{
          strokeDasharray: 60,
          strokeDashoffset: showSuccess ? 0 : 60,
          transition: 'stroke-dashoffset 0.5s ease 0.2s'
        }}
      />
    </svg>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: showSuccess ? '#0a2e1e' : 'var(--color-bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 40, transition: 'background 1s ease'
    }}>
      {!showSuccess ? (
        <>
          <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 32 }}>
            <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)', width: 120, height: 120 }}>
              <circle cx="60" cy="60" r="52" fill="none"
                stroke="var(--color-border)" strokeWidth="8" />
              <circle cx="60" cy="60" r="52" fill="none"
                stroke="var(--color-primary)" strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 52}`}
                strokeDashoffset={`${2 * Math.PI * 52 * (1 - Math.min(progress, 100) / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.4s ease' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: 'var(--color-primary)'
            }}>
              {Math.round(Math.min(progress, 100))}%
            </div>
          </div>

          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8,
                        color: 'var(--color-text)' }}>
            Uploading Documents
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-muted)',
                        textAlign: 'center', lineHeight: 1.6 }}>
            {progress < 35 ? 'Uploading identity document...'
             : progress < 65 ? 'Uploading selfie photo...'
             : progress < 90 ? 'Verifying document data...'
             : 'Finalizing submission...'}
          </div>

          <div style={{ width: '100%', maxWidth: 280, height: 4,
                        background: 'var(--color-border)', borderRadius: 2, marginTop: 24 }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'var(--color-primary)',
              width: `${Math.min(progress, 100)}%`,
              transition: 'width 0.4s ease'
            }} />
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 24 }}>
            <CheckAnim />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff',
                        marginBottom: 10, textAlign: 'center' }}>
            KYC Submitted Successfully
          </div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)',
                        textAlign: 'center', lineHeight: 1.7, marginBottom: 8 }}>
            Your documents are under review.
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)',
                        textAlign: 'center', lineHeight: 1.6, marginBottom: 32 }}>
            We will notify you within <strong style={{ color: '#0ecb81' }}>24 hours</strong>{' '}
            via email.
          </div>
          <button onClick={onDone} style={{
            padding: '14px 40px', borderRadius: 12,
            background: '#0ecb81', border: 'none',
            color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer'
          }}>
            Done
          </button>
        </>
      )}
    </div>
  );
};

// ── Main KYC ─────────────────────────────────────
export default function KYC() {
  const navigate = useNavigate();
  const [kycStatus, setKycStatus]     = useState<any>(null);
  const [step, setStep]               = useState(1);
  const [loading, setLoading]         = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [apiSuccess, setApiSuccess]   = useState(false);

  const [form, setForm] = useState({
    full_name: '', date_of_birth: '', nationality: '', address: '',
    id_type: 'national_id', id_number: '',
    id_front_url: '', id_back_url: '', selfie_url: '',
  });

  const docOptions = [
    { value: 'national_id',     label: 'Govt ID',  icon: <Shield size={18} /> },
    { value: 'passport',        label: 'Passport', icon: <AlertCircle size={18} /> },
    { value: 'driving_license', label: 'Driving',  icon: <Camera size={18} /> },
  ];

  const hasBack = DOC_SVG[form.id_type]?.hasBack ?? true;

  const saveProgress = () => {
    localStorage.setItem('kyc_draft', JSON.stringify({ ...form, step }));
  };

  useEffect(() => {
    const draft = localStorage.getItem('kyc_draft');
    if (draft) {
      try {
        const d = JSON.parse(draft);
        setForm(d);
        if (d.step) setStep(d.step);
      } catch {}
    }

    userAPI.getProfile().then((res: any) => {
      const p = res.data;
      setForm(prev => ({
        ...prev,
        full_name:     prev.full_name     || p.full_name    || '',
        date_of_birth: prev.date_of_birth || (p.date_of_birth
          ? new Date(p.date_of_birth).toISOString().split('T')[0] : ''),
        nationality:   prev.nationality   || p.nationality  || '',
        address:       prev.address       ||
          [p.address, p.city, p.state].filter(Boolean).join(', ') || '',
      }));
    }).catch(() => {});

    userAPI.getKYCStatus().then((res: any) => setKycStatus(res.data)).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!form.selfie_url) { toast.error('Selfie required'); return; }
    setLoading(true);
    setShowProgress(true);   // Show progress screen
    setApiSuccess(false);    // Reset success

    try {
      await userAPI.submitKYC(form);
      localStorage.removeItem('kyc_draft');
      const res: any = await userAPI.getKYCStatus();
      setKycStatus(res.data);
      setApiSuccess(true);   // NOW show success — only after real API response
    } catch (err: any) {
      setShowProgress(false);
      setApiSuccess(false);
      setLoading(false);
      toast.error(err?.message || 'Submission failed. Please try again.');
    }
  };

  const inp: any = {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 15, outline: 'none', boxSizing: 'border-box'
  };

  // Status screens
  if (kycStatus?.kyc_level > 0) return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%',
                    background: '#0ecb8120', border: '3px solid var(--color-success)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20 }}>
        <CheckCircle size={44} color="var(--color-success)" />
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
        Identity Verified
      </div>
      <div style={{ color: 'var(--color-muted)', fontSize: 15, textAlign: 'center' }}>
        KYC Level {kycStatus.kyc_level} — Full access unlocked
      </div>
      <button onClick={() => navigate('/profile')} style={{
        marginTop: 32, padding: '14px 32px', borderRadius: 12,
        background: 'var(--color-primary)', border: 'none',
        color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 15
      }}>Back to Profile</button>
    </div>
  );

  if (kycStatus?.submission?.status === 'pending') return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%',
                    background: '#f0b90b15', border: '3px solid var(--color-warning)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20 }}>
        <Clock size={44} color="var(--color-warning)" />
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
        Under Review
      </div>
      <div style={{ color: 'var(--color-muted)', fontSize: 15,
                    textAlign: 'center', lineHeight: 1.7 }}>
        Your KYC is being reviewed.<br />
        We will notify you within{' '}
        <strong style={{ color: 'var(--color-text)' }}>24-48 hours</strong>.
      </div>
      <div style={{ marginTop: 20, padding: '10px 20px', borderRadius: 10,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    fontSize: 13, color: 'var(--color-muted)', textAlign: 'center' }}>
        Submitted: {new Date(kycStatus.submission.created_at).toLocaleDateString()}
      </div>
      <button onClick={() => navigate(-1)} style={{
        marginTop: 24, padding: '14px 32px', borderRadius: 12,
        background: 'var(--color-surface2)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text)', fontWeight: 700,
        cursor: 'pointer', fontSize: 15
      }}>Go Back</button>
    </div>
  );

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', paddingBottom: 40 }}>

      {showProgress && (
        <SubmissionScreen
          success={apiSuccess}
          onDone={() => navigate('/profile')}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
                    height: 56, background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
                   color: 'var(--color-text)', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>ID Verification</div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            Step {step}/3 — {step === 1 ? 'Personal Info' : step === 2 ? 'Document' : 'Selfie'}
          </div>
        </div>
        <Shield size={20} color="var(--color-primary)" />
      </div>

      {kycStatus?.submission?.status === 'rejected' && (
        <div style={{ margin: '16px 20px 0', padding: '12px 16px', borderRadius: 12,
                      background: '#f6465d15', border: '1px solid #f6465d30',
                      display: 'flex', gap: 10 }}>
          <XCircle size={18} color="var(--color-danger)"
            style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: 14 }}>
              Rejected — Please resubmit
            </div>
            {kycStatus.submission.rejection_reason && (
              <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>
                {kycStatus.submission.rejection_reason}
              </div>
            )}
          </div>
        </div>
      )}

      <StepBar current={step} total={3} />

      <div style={{ padding: 20 }}>

        {step === 1 && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                Personal Details
              </div>
              <div style={{ fontSize: 14, color: 'var(--color-muted)' }}>
                As per your official ID document
              </div>
            </div>

            {[
              { key: 'full_name',     label: 'Full Name *',     placeholder: 'Exactly as on ID' },
              { key: 'date_of_birth', label: 'Date of Birth *', type: 'date' },
              { key: 'nationality',   label: 'Nationality *',   placeholder: 'e.g. Indian' },
              { key: 'address',       label: 'Address',         placeholder: 'Residential address' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
                  {f.label}
                </div>
                <input type={f.type || 'text'} value={(form as any)[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={(f as any).placeholder || ''} style={inp} />
              </div>
            ))}

            <button onClick={() => {
              if (!form.full_name)     { toast.error('Full name required'); return; }
              if (!form.date_of_birth) { toast.error('Date of birth required'); return; }
              if (!form.nationality)   { toast.error('Nationality required'); return; }
              saveProgress(); setStep(2);
            }} style={{
              width: '100%', padding: 16, borderRadius: 12, border: 'none', marginTop: 8,
              background: 'var(--color-primary)', color: '#000',
              fontWeight: 700, cursor: 'pointer', fontSize: 16
            }}>
              Continue
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                Identity Document
              </div>
              <div style={{ fontSize: 14, color: 'var(--color-muted)' }}>
                Upload clear photos of your document
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 8 }}>
                Document Type
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {docOptions.map(opt => (
                  <button key={opt.value}
                    onClick={() => setForm({
                      ...form, id_type: opt.value, id_front_url: '', id_back_url: ''
                    })}
                    style={{
                      flex: 1, padding: '12px 4px', borderRadius: 10, cursor: 'pointer',
                      border: '1px solid ' + (form.id_type === opt.value
                        ? 'var(--color-primary)' : 'var(--color-border)'),
                      background: form.id_type === opt.value
                        ? 'var(--color-primary)15' : 'var(--color-surface2)',
                      color: form.id_type === opt.value
                        ? 'var(--color-primary)' : 'var(--color-muted)',
                      fontSize: 11, fontWeight: 600, textAlign: 'center',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 4
                    }}>
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
                Document Number *
              </div>
              <input value={form.id_number}
                onChange={e => setForm({ ...form, id_number: e.target.value })}
                placeholder="Enter document number" style={inp} />
            </div>

            <ImageUpload label="Front Side *" value={form.id_front_url}
              docType={form.id_type} side="front"
              onChange={(v: string) => setForm({ ...form, id_front_url: v })} />

            {hasBack && (
              <ImageUpload label="Back Side" value={form.id_back_url}
                docType={form.id_type} side="back"
                onChange={(v: string) => setForm({ ...form, id_back_url: v })} />
            )}

            <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16,
                          background: '#f0b90b10', border: '1px solid #f0b90b20',
                          fontSize: 12, color: 'var(--color-muted)' }}>
              Ensure photos are clear, well-lit with all corners visible.
            </div>

            <button onClick={() => {
              if (!form.id_number)    { toast.error('Document number required'); return; }
              if (!form.id_front_url) { toast.error('Front photo required'); return; }
              saveProgress(); setStep(3);
            }} style={{
              width: '100%', padding: 16, borderRadius: 12, border: 'none',
              background: 'var(--color-primary)', color: '#000',
              fontWeight: 700, cursor: 'pointer', fontSize: 16
            }}>
              Continue
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                Selfie Verification
              </div>
              <div style={{ fontSize: 14, color: 'var(--color-muted)' }}>
                Hold your ID document next to your face
              </div>
            </div>

            <div style={{ background: 'var(--color-surface)', borderRadius: 12,
                          border: '1px solid var(--color-border)',
                          padding: '14px 16px', marginBottom: 20 }}>
              {[
                { icon: Camera,       text: 'Use front camera only' },
                { icon: Shield,       text: 'Good lighting, face clearly visible' },
                { icon: CheckCircle,  text: 'ID document fully visible' },
                { icon: AlertCircle,  text: 'Plain background preferred' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center',
                                         gap: 8, marginBottom: 8, fontSize: 13,
                                         color: 'var(--color-muted)' }}>
                  <Icon size={14} color="var(--color-primary)" />
                  {text}
                </div>
              ))}
            </div>

            <ImageUpload label="Selfie with ID *" value={form.selfie_url}
              isSelfie={true} docType={form.id_type} side="front"
              onChange={(v: string) => setForm({ ...form, selfie_url: v })} />

            <button onClick={handleSubmit}
              disabled={loading || !form.selfie_url} style={{
              width: '100%', padding: 16, borderRadius: 12, border: 'none', marginTop: 8,
              background: (!form.selfie_url || loading)
                ? 'var(--color-surface2)' : 'var(--color-primary)',
              color: (!form.selfie_url || loading)
                ? 'var(--color-muted)' : '#000',
              fontWeight: 700,
              cursor: (!form.selfie_url || loading) ? 'not-allowed' : 'pointer',
              fontSize: 16
            }}>
              {loading ? 'Submitting...' : 'Submit for Verification'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12,
                          color: 'var(--color-muted)' }}>
              Review takes 24-48 hours. We will notify by email.
            </div>
          </>
        )}
      </div>
    </div>
  );
}