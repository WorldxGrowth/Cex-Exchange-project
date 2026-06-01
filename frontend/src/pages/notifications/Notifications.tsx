import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifAPI } from '../../services/api';
import { Bell, Check, Trash2, ArrowLeft, BellOff } from 'lucide-react';
import toast from 'react-hot-toast';

const typeColors: Record<string, string> = {
  deposit:    'var(--color-success)',
  withdrawal: 'var(--color-warning)',
  trade:      'var(--color-secondary)',
  security:   'var(--color-danger)',
  system:     'var(--color-primary)',
  kyc:        '#722ed1',
};

const typeIcons: Record<string, string> = {
  deposit:    '📥',
  withdrawal: '📤',
  trade:      '📊',
  security:   '🔐',
  system:     '📢',
  kyc:        '🪪',
};

export default function Notifications() {
  const navigate  = useNavigate();
  const [notifs, setNotifs]     = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [unread, setUnread]     = useState(0);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<'notifs'|'announcements'>('notifs');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [nRes, aRes]: any[] = await Promise.all([
        notifAPI.getAll(),
        notifAPI.getAnnouncements(),
      ]);
      setNotifs(nRes.data?.notifications || []);
      setUnread(nRes.data?.unread_count  || 0);
      setAnnouncements(aRes.data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const markAllRead = async () => {
    try {
      await notifAPI.markRead('all');
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnread(0);
      toast.success('All marked as read');
    } catch (e) {}
  };

  const markRead = async (id: string) => {
    try {
      await notifAPI.markRead(id);
      setNotifs(prev => prev.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      ));
      setUnread(prev => Math.max(0, prev - 1));
    } catch (e) {}
  };

  const deleteNotif = async (id: string) => {
    try {
      await notifAPI.markRead(id);
      setNotifs(prev => prev.filter(n => n.id !== id));
      toast.success('Deleted');
    } catch (e) {}
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'Just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 16px', height: 56,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate(-1)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text)', display: 'flex', alignItems: 'center'
          }}>
            <ArrowLeft size={22} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 17 }}>
            Notifications
            {unread > 0 && (
              <span style={{
                marginLeft: 8, background: 'var(--color-danger)',
                color: '#fff', borderRadius: 10,
                padding: '1px 7px', fontSize: 11, fontWeight: 700
              }}>{unread}</span>
            )}
          </span>
        </div>

        {unread > 0 && (
          <button onClick={markAllRead} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-primary)', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 4
          }}>
            <Check size={14} /> Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)'
      }}>
        {(['notifs', 'announcements'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: '12px 0', border: 'none',
            background: 'none', cursor: 'pointer',
            color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-muted)',
            fontWeight: activeTab === tab ? 700 : 400,
            fontSize: 14,
            borderBottom: activeTab === tab
              ? '2px solid var(--color-primary)' : '2px solid transparent',
          }}>
            {tab === 'notifs' ? `Notifications${unread > 0 ? ` (${unread})` : ''}` : 'Announcements'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ paddingBottom: 80 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40,
                        color: 'var(--color-muted)' }}>Loading...</div>
        ) : activeTab === 'notifs' ? (
          notifs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <BellOff size={40} color="var(--color-muted)" style={{ marginBottom: 12 }} />
              <div style={{ color: 'var(--color-muted)', fontSize: 15 }}>
                No notifications yet
              </div>
            </div>
          ) : (
            notifs.map(n => (
              <div key={n.id} onClick={() => !n.is_read && markRead(n.id)}
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--color-border)',
                  background: n.is_read ? 'transparent' : 'var(--color-surface)',
                  display: 'flex', gap: 12, cursor: 'pointer',
                }}>
                {/* Icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: (typeColors[n.type] || 'var(--color-primary)') + '20',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 18
                }}>
                  {typeIcons[n.type] || '🔔'}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                alignItems: 'flex-start', gap: 8 }}>
                    <div style={{
                      fontWeight: n.is_read ? 400 : 700,
                      fontSize: 14, color: 'var(--color-text)',
                      lineHeight: 1.3
                    }}>
                      {n.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                                  flexShrink: 0 }}>
                      {!n.is_read && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%',
                                      background: 'var(--color-primary)' }} />
                      )}
                      <span style={{ fontSize: 11, color: 'var(--color-muted)',
                                     whiteSpace: 'nowrap' }}>
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-muted)',
                                marginTop: 3, lineHeight: 1.4 }}>
                    {n.message}
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          // Announcements tab
          announcements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px',
                          color: 'var(--color-muted)' }}>
              No announcements
            </div>
          ) : (
            announcements.map((a: any) => (
              <div key={a.id} style={{
                margin: '12px 16px',
                background: 'var(--color-surface)',
                borderRadius: 12,
                border: '1px solid var(--color-border)',
                overflow: 'hidden'
              }}>
                {a.image_url && (
                  <img src={a.image_url} alt={a.title}
                    style={{ width: '100%', maxHeight: 160,
                             objectFit: 'cover' }} />
                )}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{a.title}</span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 10,
                      background: 'var(--color-primary)20',
                      color: 'var(--color-primary)', fontWeight: 600
                    }}>{a.type}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-muted)',
                                lineHeight: 1.6 }}>
                    {a.content}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)',
                                marginTop: 8 }}>
                    {timeAgo(a.published_at || a.created_at)}
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
