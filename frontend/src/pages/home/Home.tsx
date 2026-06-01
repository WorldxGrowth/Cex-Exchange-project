import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { walletAPI, marketAPI, userAPI, notifAPI } from '../../services/api';
import { subscribeToTicker } from '../../services/socket';
import {
  TrendingUp, TrendingDown, Eye, EyeOff,
  ArrowDownLeft, ArrowUpRight, Repeat, Users, Gift,
  Shield, CheckCircle, ArrowRight, User, Star,
  LayoutGrid, HelpCircle, ChevronRight
} from 'lucide-react';

// ── Mini Sparkline Chart ──────────────────────────
const Sparkline = ({ change }: { change: number }) => {
  const isUp   = change >= 0;
  const color  = isUp ? '#0ecb81' : '#f6465d';
  // Generate fake but smooth sparkline points
  const points = [40,38,42,35,45,38,50,44,48,42,55,50,isUp ? 58 : 35];
  const max    = Math.max(...points);
  const min    = Math.min(...points);
  const norm   = (v: number) => 40 - ((v - min) / (max - min)) * 36;
  const coords = points.map((p, i) => `${(i / (points.length - 1)) * 80},${norm(p)}`).join(' ');

  return (
    <svg width="80" height="40" viewBox="0 0 80 40">
      <defs>
        <linearGradient id={`grad-${isUp ? 'up' : 'dn'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default function Home() {
  const navigate = useNavigate();
  const { prices, pairs: cachedPairs, setPairs, pairsLoadedAt } = useStore();

  const [totalBalance, setTotalBalance]       = useState('0.00');
  const [change24h]                           = useState({ amount: '0.00', pct: '0.00', up: true });
  const [hideBalance, setHideBalance]         = useState(false);
  const [pairs, setPairsLocal]                = useState<any[]>(cachedPairs || []);
  const [activeTab, setActiveTab]             = useState<'hot'|'gainers'|'losers'|'new'>('hot');
  const [profileComplete, setProfileComplete] = useState(true);
  const [kycLevel, setKycLevel]               = useState(0);
  const [popup, setPopup]                     = useState<any>(null);
  const [showPopup, setShowPopup]             = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    if (cachedPairs.length > 0) {
      setPairsLocal(cachedPairs);
      cachedPairs.forEach((p: any) => subscribeToTicker(p.symbol));
    }

    walletAPI.getBalances().then((res: any) => {
      if (isMounted.current)
        setTotalBalance(parseFloat(res.data.total_usdt || 0).toFixed(2));
    }).catch(() => {});

    userAPI.getProfile().then((res: any) => {
      if (!isMounted.current) return;
      const p = res.data;
      setProfileComplete(!!(p?.phone || p?.full_name));
      setKycLevel(p?.kyc_level || 0);
    }).catch(() => {});

    const cacheAge = Date.now() - pairsLoadedAt;
    if (cachedPairs.length === 0 || cacheAge > 60000) {
      marketAPI.getPairs().then((res: any) => {
        if (!isMounted.current) return;
        setPairsLocal(res.data);
        setPairs(res.data);
        res.data.forEach((p: any) => subscribeToTicker(p.symbol));
      }).catch(() => {});
    }

    notifAPI.getPopups().then((res: any) => {
      if (!isMounted.current) return;
      const popups = res.data || [];
      if (popups.length > 0) { setPopup(popups[0]); setShowPopup(true); }
    }).catch(() => {});

    return () => { isMounted.current = false; };
  }, []);

  const getFilteredPairs = () => {
    switch (activeTab) {
      case 'gainers': return [...pairs].sort((a, b) =>
        parseFloat(b.change_24h||0) - parseFloat(a.change_24h||0));
      case 'losers':  return [...pairs].sort((a, b) =>
        parseFloat(a.change_24h||0) - parseFloat(b.change_24h||0));
      case 'new':     return [...pairs].sort((a, b) =>
        new Date(b.created_at||0).getTime() - new Date(a.created_at||0).getTime());
      default:        return pairs;
    }
  };

  const quickActions = [
    { icon: ArrowDownLeft, label: 'Deposit',  action: () => navigate('/deposit'),  color: '#0ecb81' },
    { icon: ArrowUpRight,  label: 'Withdraw', action: () => navigate('/withdraw'), color: '#f6465d' },
    { icon: Repeat,        label: 'Transfer', action: () => navigate('/transfer'), color: '#1890ff' },
    { icon: Users,         label: 'Referral', action: () => navigate('/referral'), color: '#f0b90b' },
    { icon: Gift,          label: 'Listing',  action: () => navigate('/listing'),  color: '#722ed1' },
    { icon: Star,          label: 'VIP',      action: () => alert('Coming soon'),  color: '#f0b90b' },
    { icon: HelpCircle,    label: 'Support',  action: () => navigate('/support'),  color: '#13c2c2' },
    { icon: LayoutGrid,    label: 'More',     action: () => navigate('/more'),     color: '#848e9c' },
  ];

  const steps = [
    { done: profileComplete, label: 'Complete Profile', action: '/edit-profile', icon: User },
    { done: kycLevel > 0,    label: 'Verify KYC',       action: '/kyc',          icon: Shield },
  ];
  const allDone   = steps.every(s => s.done);
  const nextStep  = steps.find(s => !s.done);
  const doneCount = steps.filter(s => s.done).length;

  const tabs = [
    { key: 'hot',     label: 'Popular' },
    { key: 'gainers', label: 'Gainers' },
    { key: 'losers',  label: 'Losers' },
    { key: 'new',     label: 'New' },
  ] as const;

  // Overall portfolio change from pairs
  const portfolioChange = pairs.length > 0
    ? pairs.reduce((s, p) => s + parseFloat(p.change_24h||0), 0) / pairs.length
    : 0;
  const changeUp = portfolioChange >= 0;

  return (
    <div style={{ background: 'var(--color-bg)', paddingBottom: 20 }}>

      {/* ── Popup ── */}
      {showPopup && popup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999,
                      background: 'rgba(0,0,0,0.75)',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 20,
                        width: '100%', maxWidth: 360, overflow: 'hidden',
                        border: '1px solid var(--color-border)' }}>
            {popup.image_url && (
              <img src={popup.image_url} alt={popup.title}
                style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
            )}
            <div style={{ padding: '20px 20px 24px' }}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
                {popup.title}
              </div>
              {popup.content && (
                <div style={{ fontSize: 14, color: 'var(--color-muted)',
                              lineHeight: 1.6, marginBottom: 20 }}>
                  {popup.content}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                {popup.link_url && (
                  <button onClick={() => { window.open(popup.link_url); setShowPopup(false); }}
                    style={{ flex: 1, padding: '12px', borderRadius: 12,
                             border: 'none', background: 'var(--color-primary)',
                             color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                    {popup.link_text || 'Learn More'}
                  </button>
                )}
                <button onClick={() => setShowPopup(false)} style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  border: '1px solid var(--color-border)',
                  background: 'none', color: 'var(--color-muted)',
                  fontWeight: 600, cursor: 'pointer', fontSize: 14
                }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Balance Section ── */}
      <div style={{ background: 'var(--color-bg)', padding: '24px 20px 20px' }}>

        {/* Total + sparkline row */}
        <div style={{ display: 'flex', alignItems: 'flex-start',
                      justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>Total Balance</span>
              <button onClick={() => setHideBalance(!hideBalance)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-muted)', display: 'flex'
              }}>
                {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--color-text)',
                             letterSpacing: -1 }}>
                {hideBalance ? '••••••' : totalBalance}
              </span>
              <span style={{ fontSize: 14, color: 'var(--color-muted)' }}>USDT</span>
            </div>
            {/* 24h change */}
            {!hideBalance && (
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600,
                               color: changeUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {changeUp ? '+' : ''}{portfolioChange.toFixed(2)}%
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>24h</span>
              </div>
            )}
          </div>

          {/* Mini sparkline */}
          {!hideBalance && (
            <div style={{ paddingTop: 8 }}>
              <Sparkline change={portfolioChange} />
            </div>
          )}
        </div>

        {/* Deposit button */}
        <button onClick={() => navigate('/deposit')} style={{
          width: '100%', padding: '16px', borderRadius: 14, border: 'none',
          background: 'var(--color-primary)', color: '#000',
          fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 20
        }}>
          Deposit
        </button>

        {/* Quick Actions 2x4 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 12, marginTop: 20 }}>
          {quickActions.map(({ icon: Icon, label, action, color }) => (
            <button key={label} onClick={action} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7
            }}>
              <div style={{
                width: 54, height: 54, borderRadius: 16,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Icon size={22} color={color} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-muted)',
                             fontWeight: 500 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Onboarding Banner ── */}
      {!allDone && (
        <div onClick={() => nextStep && navigate(nextStep.action)}
          style={{ margin: '0 16px 12px', padding: '14px 16px', borderRadius: 14,
                   cursor: 'pointer',
                   background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                   border: '1px solid rgba(240,185,11,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#f0b90b', marginBottom: 6 }}>
                Complete Account Setup
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {steps.map(({ done, label, icon: Icon }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {done ? <CheckCircle size={13} color="#0ecb81" />
                           : <Icon size={13} color="#848e9c" />}
                    <span style={{ fontSize: 12,
                                   color: done ? '#0ecb81' : '#848e9c',
                                   textDecoration: done ? 'line-through' : 'none' }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <ArrowRight size={18} color="#f0b90b" />
          </div>
          <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }}>
            <div style={{ height: '100%', borderRadius: 2, background: '#f0b90b',
                          width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* ── Markets ── */}
      <div style={{ padding: '4px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
            Markets
          </span>
          <span onClick={() => navigate('/markets')}
            style={{ fontSize: 13, color: 'var(--color-primary)', cursor: 'pointer',
                     display: 'flex', alignItems: 'center', gap: 2 }}>
            See all <ChevronRight size={14} />
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeTab === tab.key ? '#000' : 'var(--color-muted)',
              fontSize: 12, fontWeight: activeTab === tab.key ? 700 : 500,
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Pair list */}
        {pairs.length === 0
          ? Array(5).fill(0).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '12px 0',
                                   borderBottom: '1px solid var(--color-border)', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%',
                            background: 'var(--color-surface)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: 80, height: 13, borderRadius: 4,
                              background: 'var(--color-surface)', marginBottom: 5 }} />
                <div style={{ width: 60, height: 11, borderRadius: 4,
                              background: 'var(--color-surface)' }} />
              </div>
              <div style={{ width: 70, height: 13, borderRadius: 4,
                            background: 'var(--color-surface)' }} />
            </div>
          ))
          : getFilteredPairs().slice(0, 8).map(pair => {
            const live   = prices[pair.symbol];
            const price  = live?.price || pair.price;
            const change = parseFloat(live?.change_24h || pair.change_24h || 0);
            const isUp   = change >= 0;

            return (
              <div key={pair.symbol}
                onClick={() => navigate('/trade/' + pair.symbol)}
                style={{ display: 'flex', alignItems: 'center',
                         justifyContent: 'space-between', padding: '12px 0',
                         borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {pair.base_logo
                    ? <img src={pair.base_logo} alt={pair.base_symbol}
                        style={{ width: 40, height: 40, borderRadius: '50%' }}
                        onError={(e) => { (e.target as any).style.display = 'none'; }} />
                    : <div style={{ width: 40, height: 40, borderRadius: '50%',
                                    background: 'var(--color-surface)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 700, color: 'var(--color-primary)', fontSize: 14 }}>
                        {pair.base_symbol?.charAt(0)}
                      </div>
                  }
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                      {pair.base_symbol}
                      <span style={{ color: 'var(--color-muted)', fontWeight: 400,
                                     fontSize: 12 }}>/USDT</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                      Vol ${(parseFloat(pair.volume_24h||0)/1000000).toFixed(1)}M
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                    ${parseFloat(price||0).toLocaleString(undefined,
                      { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '3px 8px', borderRadius: 6, marginTop: 3,
                    background: isUp ? '#0ecb8118' : '#f6465d18',
                    color: isUp ? 'var(--color-success)' : 'var(--color-danger)',
                    fontSize: 11, fontWeight: 700
                  }}>
                    {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {isUp ? '+' : ''}{change.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}
