import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { authAPI } from '../../services/api';

export default function GoogleSuccess() {
  const [params] = useSearchParams();
  const { setUser } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    const email = params.get('email');

    if (!token) { navigate('/login'); return; }

    // Token store karo + user fetch karo
    authAPI.me().then((res: any) => {
      setUser(res.data, token);
      navigate('/home');
    }).catch(() => navigate('/login'));
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: 'var(--color-bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <div style={{ color: 'var(--color-text)', fontSize: 16 }}>
          Signing you in...
        </div>
      </div>
    </div>
  );
}
