import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../../services/api';
import { Shield, ChevronLeft, CheckCircle, Clock, XCircle, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';

// Image Upload Component
const ImageUpload = ({ label, value, onChange, required }: any) => {
  const [preview, setPreview] = useState(value || '');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB allowed'); return; }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
      onChange(result); // base64 as URL
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>{label}</div>

      {preview ? (
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden',
                      border: '1px solid var(--color-border)' }}>
          <img src={preview} alt="preview"
            style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
          <button onClick={() => { setPreview(''); onChange(''); }}
            style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28,
                     borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none',
                     cursor: 'pointer', color: '#fff', display: 'flex',
                     alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
          <div style={{ padding: '6px 10px', background: 'rgba(14,203,129,0.1)',
                        fontSize: 11, color: 'var(--color-success)', textAlign: 'center' }}>
            ✅ Image selected
          </div>
        </div>
      ) : (
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <div style={{ padding: '20px', borderRadius: 10, textAlign: 'center',
                        border: '2px dashed var(--color-border)',
                        background: 'var(--color-surface2)',
                        transition: 'border-color 0.2s' }}>
            <Upload size={28} color="var(--color-muted)" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500 }}>
              Tap to upload photo
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
              JPG, PNG • Max 5MB
            </div>
          </div>
          <input type="file" accept="image/*" onChange={handleFile}
            style={{ display: 'none' }} capture="environment" />
        </label>
      )}
    </div>
  );
};

export default function KYC() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '', date_of_birth: '', nationality: '',
    id_type: 'national_id', id_number: '',
    id_front_url: '', id_back_url: '', selfie_url: '', address: ''
  });

  useEffect(() => {
    userAPI.getKYCStatus().then((res: any) => setStatus(res.data));
  }, []);

  const handleSubmit = async () => {
    if (!form.full_name) { toast.error('Full name required'); return; }
    if (!form.id_number) { toast.error('ID number required'); return; }
    if (!form.id_front_url) { toast.error('ID front photo required'); return; }
    if (!form.selfie_url) { toast.error('Selfie with ID required'); return; }

    setLoading(true);
    try {
      await userAPI.submitKYC(form);
      toast.success('KYC submitted! Under review.');
      userAPI.getKYCStatus().then((res: any) => setStatus(res.data));
    } catch (err: any) {
      toast.error(err?.message || 'Submission failed');
    } finally { setLoading(false); }
  };

  const inp: any = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    marginTop: 4
  };

  const statusColors: any = {
    pending: 'var(--color-warning)',
    approved: 'var(--color-success)',
    rejected: 'var(--color-danger)'
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', paddingBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
          KYC Verification
        </span>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Status */}
        {status?.submission && (
          <div style={{ padding: '14px', borderRadius: 12, marginBottom: 20,
                        background: statusColors[status.submission.status] + '15',
                        border: '1px solid ' + statusColors[status.submission.status] + '30',
                        display: 'flex', alignItems: 'center', gap: 10 }}>
            {status.submission.status === 'approved'
              ? <CheckCircle size={20} color="var(--color-success)" />
              : status.submission.status === 'rejected'
              ? <XCircle size={20} color="var(--color-danger)" />
              : <Clock size={20} color="var(--color-warning)" />
            }
            <div>
              <div style={{ fontWeight: 600, color: statusColors[status.submission.status] }}>
                KYC {status.submission.status.charAt(0).toUpperCase() +
                     status.submission.status.slice(1)}
              </div>
              {status.submission.rejection_reason && (
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                  {status.submission.rejection_reason}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verified */}
        {status?.kyc_level > 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <CheckCircle size={60} color="var(--color-success)" style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
              Verified! ✅
            </div>
            <div style={{ color: 'var(--color-muted)', fontSize: 14 }}>
              KYC Level {status.kyc_level} verified
            </div>
          </div>
        ) : status?.submission?.status === 'pending' ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Clock size={60} color="var(--color-warning)" style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
              Under Review ⏳
            </div>
            <div style={{ color: 'var(--color-muted)', fontSize: 14 }}>
              Usually takes 24-48 hours
            </div>
          </div>
        ) : (
          <>
            {/* Benefits */}
            <div style={{ padding: '14px 16px', borderRadius: 12, marginBottom: 20,
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 8, fontSize: 14 }}>
                <Shield size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Why verify?
              </div>
              {['Higher withdrawal limits', 'Access all features',
                'Account security', 'Compliance requirement'].map(item => (
                <div key={item} style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 3 }}>
                  ✅ {item}
                </div>
              ))}
            </div>

            {/* Form */}
            <div style={{ background: 'var(--color-surface)', borderRadius: 12,
                          padding: '16px', border: '1px solid var(--color-border)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 16, fontSize: 15 }}>
                Personal Information
              </div>

              {[
                { key: 'full_name', label: 'Full Name *', placeholder: 'As per ID' },
                { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
                { key: 'nationality', label: 'Nationality', placeholder: 'e.g. Indian' },
                { key: 'id_number', label: 'ID Number *', placeholder: 'ID/Passport number' },
                { key: 'address', label: 'Address', placeholder: 'Residential address' },
              ].map(field => (
                <div key={field.key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{field.label}</div>
                  <input type={field.type || 'text'}
                    value={(form as any)[field.key]}
                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    placeholder={(field as any).placeholder || ''}
                    style={inp} />
                </div>
              ))}

              {/* ID Type */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>ID Type *</div>
                <select value={form.id_type}
                  onChange={e => setForm({ ...form, id_type: e.target.value })}
                  style={{ ...inp, marginTop: 0 }}>
                  <option value="national_id">National ID</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving License</option>
                </select>
              </div>

              {/* Photo Uploads */}
              <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 12, fontSize: 14 }}>
                Document Photos
              </div>

              <ImageUpload label="ID Front Photo *" value={form.id_front_url}
                onChange={(v: string) => setForm({ ...form, id_front_url: v })} />

              <ImageUpload label="ID Back Photo" value={form.id_back_url}
                onChange={(v: string) => setForm({ ...form, id_back_url: v })} />

              <ImageUpload label="Selfie with ID *" value={form.selfie_url}
                onChange={(v: string) => setForm({ ...form, selfie_url: v })} />

              {/* Warning */}
              <div style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 16,
                            background: 'rgba(240,185,11,0.08)',
                            border: '1px solid rgba(240,185,11,0.2)',
                            fontSize: 12, color: 'var(--color-muted)' }}>
                ⚠️ Make sure photos are clear, well-lit, and all text is readable.
              </div>

              <button onClick={handleSubmit} disabled={loading} style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                background: loading ? 'var(--color-border)' : 'var(--color-primary)',
                color: '#000', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
              }}>
                {loading ? 'Submitting...' : 'Submit KYC'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
