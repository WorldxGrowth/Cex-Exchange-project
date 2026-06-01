import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { notifAPI } from '../../services/api';
import { Search, ScanLine, HelpCircle, Bell, Sun, Moon, UserCircle } from 'lucide-react';

export default function Header() {
  const { theme, toggleTheme } = useStore();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    notifAPI.getAll().then((res: any) => {
      setUnreadCount(res.data?.unread_count || 0);
    }).catch(() => {});
  }, []);

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      height: '56px', display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 10
    }}>
      {/* LEFT: Profile Icon */}
      <button onClick={() => navigate('/profile')} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        flexShrink: 0, padding: 0, display: 'flex', alignItems: 'center'
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <UserCircle size={22} color="#000" />
        </div>
      </button>

      {/* MIDDLE: Search Bar */}
      <div onClick={() => navigate('/markets')}
        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                 padding: '8px 12px', borderRadius: 20,
                 background: 'var(--color-surface2)',
                 border: '1px solid var(--color-border)', cursor: 'pointer' }}>
        <Search size={14} color="var(--color-muted)" />
        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Search coin...</span>
      </div>

      {/* RIGHT: Icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <button onClick={toggleTheme} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-muted)', padding: '6px',
          display: 'flex', alignItems: 'center'
        }}>
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        <button onClick={() => navigate('/scanner')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-muted)', padding: '6px',
          display: 'flex', alignItems: 'center'
        }}>
          <ScanLine size={19} />
        </button>

        <button onClick={() => navigate('/support')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-muted)', padding: '6px',
          display: 'flex', alignItems: 'center'
        }}>
          <HelpCircle size={19} />
        </button>

        {/* Bell - with unread badge */}
        <button onClick={() => navigate('/notifications')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-muted)', padding: '6px',
          position: 'relative', display: 'flex', alignItems: 'center'
        }}>
          <Bell size={19} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              minWidth: 16, height: 16, borderRadius: 8,
              background: 'var(--color-danger)',
              border: '1.5px solid var(--color-surface)',
              fontSize: 9, fontWeight: 700, color: '#fff',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: '0 3px'
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
