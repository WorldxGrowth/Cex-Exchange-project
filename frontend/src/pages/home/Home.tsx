import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { walletAPI, marketAPI, userAPI, notifAPI } from '../../services/api';
import { subscribeToTicker } from '../../services/socket';
import { CheckCircle, ArrowRight, User, Shield } from 'lucide-react';

import HomeBalance      from '../../components/home/HomeBalance';
import HomeQuickActions from '../../components/home/HomeQuickActions';
import HomeMarkets      from '../../components/home/HomeMarkets';

function useIsDesktop() {
  const [desktop, setDesktop] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const h = () => setDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return desktop;
}

export default function Home() {
  const navigate = useNavigate();
  const { prices, pairs: cachedPairs, setPairs, pairsLoadedAt } = useStore();
  const desktop = useIsDesktop();

  const [totalBalance, setTotalBalance]       = useState('0.00');
  const [hideBalance, setHideBalance]         = useState(false);
  const [pairs, setPairsLocal]                = useState<any[]>(cachedPairs || []);
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

  const steps = [
    { done: profileComplete, label: 'Complete Profile', action: '/edit-profile', icon: User },
    { done: kycLevel > 0,    label: 'Verify KYC',       action: '/kyc',          icon: Shield },
  ];
  const allDone   = steps.every(s => s.done);
  const nextStep  = steps.find(s => !s.done);
  const doneCount = steps.filter(s => s.done).length;

  const portfolioChange = pairs.length > 0
    ? pairs.filter(p => p.is_active)
           .reduce((s, p) => s + parseFloat(p.change_24h||0), 0)
      / pairs.filter(p => p.is_active).length
    : 0;

  const onboardingBanner = !allDone && (
    <div onClick={() => nextStep && navigate(nextStep.action)}
      style={{ margin: desktop ? '0 0 16px' : '16px 16px 12px',
               padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
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
  );

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', paddingBottom: 20 }}>

      {/* Popup */}
      {showPopup && popup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999,
                      background: 'rgba(0,0,0,0.75)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 20,
                        width: '100%', maxWidth: 360, overflow: 'hidden',
                        border: '1px solid var(--color-border)' }}>
            {popup.image_url && (
              <img src={popup.image_url} alt={popup.title}
                style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
            )}
            <div style={{ padding: '20px 20px 24px' }}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>{popup.title}</div>
              {popup.content && (
                <div style={{ fontSize: 14, color: 'var(--color-muted)',
                              lineHeight: 1.6, marginBottom: 20 }}>{popup.content}</div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                {popup.link_url && (
                  <button onClick={() => { window.open(popup.link_url); setShowPopup(false); }}
                    style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                             background: 'var(--color-primary)', color: '#000',
                             fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                    {popup.link_text || 'Learn More'}
                  </button>
                )}
                <button onClick={() => setShowPopup(false)} style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  border: '1px solid var(--color-border)', background: 'none',
                  color: 'var(--color-muted)', fontWeight: 600, cursor: 'pointer', fontSize: 14
                }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE LAYOUT ── */}
      {!desktop && (
        <>
          <div style={{ padding: '24px 20px 20px', background: 'var(--color-bg)' }}>
            <HomeBalance
              totalBalance={totalBalance}
              hideBalance={hideBalance}
              portfolioChange={portfolioChange}
              onToggleHide={() => setHideBalance(!hideBalance)}
            />
          </div>
          <HomeQuickActions />
          {onboardingBanner}
          <HomeMarkets pairs={pairs} prices={prices} />
        </>
      )}

      {/* ── DESKTOP LAYOUT ── */}
      {desktop && (
        <div style={{ maxWidth: 1280, margin: '0 auto',
                      display: 'flex', gap: 24, padding: '24px 24px 0', alignItems: 'flex-start' }}>

          {/* LEFT: Balance + Actions + Onboarding */}
          <div style={{ width: 380, flexShrink: 0 }}>
            {/* Balance Card */}
            <div style={{ background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 20, padding: '24px', marginBottom: 16 }}>
              <HomeBalance
                totalBalance={totalBalance}
                hideBalance={hideBalance}
                portfolioChange={portfolioChange}
                onToggleHide={() => setHideBalance(!hideBalance)}
              />
            </div>

            {/* Quick Actions Card */}
            <div style={{ background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 20, padding: '20px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16,
                            color: 'var(--color-text)' }}>Quick Actions</div>
              <HomeQuickActions />
            </div>

            {/* Onboarding */}
            {onboardingBanner}
          </div>

          {/* RIGHT: Markets */}
          <div style={{ flex: 1, minWidth: 0,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 20, overflow: 'hidden' }}>
            <HomeMarkets pairs={pairs} prices={prices} desktop={true} />
          </div>
        </div>
      )}
    </div>
  );
}
