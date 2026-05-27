import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../../services/api';
import { ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EditProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '', phone: '', address: '', nationality: '', date_of_birth: ''
  });

  useEffect(() => {
    userAPI.getProfile().then((res: any) => {
      const p = res.data;
      setForm({
        full_name: p.full_name || '',
        phone: p.phone || '',
        address: p.address || '',
        nationality: p.nationality || '',
        date_of_birth: p.date_of_birth ? new Date(p.date_of_birth).toISOString().split('T')[0] : ''
      });
    });
  }, []);

  const handleSubmit = async () => {
    if (!form.full_name) { toast.error('Full name required'); return; }
    setLoading(true);
    try {
      await userAPI.updateProfile(form);
      toast.success('Profile updated!');
      navigate('/profile');
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally { setLoading(false); }
  };

  const inp: any = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
          Edit Profile
        </span>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ background: 'var(--color-surface)', borderRadius: 12,
                      padding: 16, border: '1px solid var(--color-border)' }}>
          {[
            { key: 'full_name', label: 'Full Name *', placeholder: 'Your full name' },
            { key: 'phone', label: 'Phone Number', placeholder: '+91 98765 43210', type: 'tel' },
            { key: 'nationality', label: 'Nationality', placeholder: 'e.g. Indian' },
            { key: 'address', label: 'Address', placeholder: 'Your address' },
            { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>{f.label}</div>
              <input type={f.type || 'text'} value={(form as any)[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder} style={inp} />
            </div>
          ))}

          <button onClick={handleSubmit} disabled={loading} style={{
            width: '100%', padding: 14, borderRadius: 12, border: 'none',
            background: loading ? 'var(--color-border)' : 'var(--color-primary)',
            color: '#000', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
          }}>
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
