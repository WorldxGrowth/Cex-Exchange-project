import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { useStore } from '../../store/useStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Zap } from 'lucide-react';

export default function Register() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    email: '', password: '', confirm_password: '',
    referral_code: searchParams.get('ref') || ''
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setUser } = useStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res: any = await authAPI.register({
        email: form.email, password: form.password,
        referral_code: form.referral_code || undefined
      });
      setUser(res.data.user, res.data.access_token);
      toast.success('Account created successfully!');
      navigate('/home');
    } catch (err: any) {
      toast.error(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: 10,
    background: 'var(--color-surface2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)', fontSize: 14, outline: 'none'
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--color-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
            background: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Zap size={28} color="#000" />
          </div>
          <h1 style={{ color: 'var(--color-text)', fontSize: 24, fontWeight: 700, margin: 0 }}>
            Create Account
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 14, marginTop: 4 }}>
            Join VDExchange today
          </p>
        </div>

        <div style={{
          background: 'var(--color-surface)', borderRadius: 16,
          padding: 24, border: '1px solid var(--color-border)'
        }}>
          <form onSubmit={handleSubmit}>
            {[
              { key: 'email', label: 'Email Address', type: 'email', placeholder: 'Enter your email' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: 16 }}>
                <label style={{ color: 'var(--color-muted)', fontSize: 13, display: 'block', marginBottom: 6 }}>
                  {field.label}
                </label>
                <input
                  type={field.type} required
                  value={(form as any)[field.key]}
                  onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  style={inputStyle}
                />
              </div>
            ))}

            {['password', 'confirm_password'].map((key, i) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ color: 'var(--color-muted)', fontSize: 13, display: 'block', marginBottom: 6 }}>
                  {i === 0 ? 'Password' : 'Confirm Password'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'} required
                    value={(form as any)[key]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    placeholder={i === 0 ? 'Min 8 characters' : 'Repeat password'}
                    style={{ ...inputStyle, paddingRight: 44 }}
                  />
                  {i === 0 && (
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                               background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}>
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div style={{ marginBottom: 24 }}>
              <label style={{ color: 'var(--color-muted)', fontSize: 13, display: 'block', marginBottom: 6 }}>
                Referral Code (Optional)
              </label>
              <input
                type="text"
                value={form.referral_code}
                onChange={e => setForm({ ...form, referral_code: e.target.value })}
                placeholder="Enter referral code"
                style={inputStyle}
              />
            </div>

            <button type="submit" disabled={loading}
              style={{
                width: '100%', padding: '13px', borderRadius: 10,
                background: loading ? 'var(--color-border)' : 'var(--color-primary)',
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                color: '#000', fontSize: 15, fontWeight: 700
              }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>Already have an account? </span>
            <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: 14 }}>Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
