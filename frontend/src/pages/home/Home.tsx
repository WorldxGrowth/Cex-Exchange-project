import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { walletAPI, marketAPI, userAPI } from '../../services/api';
import { subscribeToTicker } from '../../services/socket';
import { TrendingUp, TrendingDown, ChevronRight, Eye, EyeOff,
         ArrowDownLeft, ArrowUpRight, Repeat, Coins, Users, Gift,
         Shield, CheckCircle, ArrowRight, User } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { prices, pairs: cachedPairs, setPairs, pairsLoadedAt } = useStore();
  const [totalBalance, setTotalBalance] = useState('0.00');
  const [hideBalance, setHideBalance] = useState(false);
  const [pairs, setPairsLocal] = useState<any[]>(cachedPairs || []);
  const [activeTab, setActiveTab] = useState<'hot'|'gainers'|'losers'>('hot');
  const [profileComplete, setProfileComplete] = useState(true);
  const [kycLevel, setKycLevel] = useState(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    // Cache se instant load
    if (cachedPairs.length > 0) {
      setPairsLocal(cachedPairs);
      cachedPairs.forEach((p: any) => subscribeToTicker(p.symbol));
    }

    // Balance
    walletAPI.getBalances().then((res: any) => {
      if (isMounted.current)
        setTotalBalance(parseFloat(res.data.total_usdt || 0).toFixed(2));
    }).catch(() => {});

    // Profile check
    userAPI.getProfile().then((res: any) => {
      if (!isMounted.current) return;
      const p = res.data;
      setProfileComplete(!!(p?.phone || p?.full_name));
      setKycLevel(p?.kyc_level || 0);
    }).catch(() => {});

    // Pairs refresh
    const cacheAge = Date.now() - pairsLoadedAt;
    if (cachedPairs.length === 0 || cacheAge > 60000) {
      marketAPI.getPairs().then((res: any) => {
        if (!isMounted.current) return;
        setPairsLocal(res.data);
        setPairs(res.data);
        res.data.forEach((p: any) => subscribeToTicker(p.symbol));
      }).catch(() => {});
    }

    return () => { isMounted.current = false; };
  }, []);

  const getFilteredPairs = () => {
    switch (activeTab) {
      case 'gainers': return [...pairs].sort((a, b) =>
        parseFloat(b.change_24h||0) - parseFloat(a.change_24h||0));
      case 'losers': return [...pairs].sort((a, b) =>
        parseFloat(a.change_24h||0) - parseFloat(b.change_24h||0));
      default: return pairs;
    }
  };

  const quickActions = [
    { icon: ArrowDownLeft, label: 'Deposit',  action: () => navigate('/deposit'),  color: '#0ecb81' },
    { icon: ArrowUpRight,  label: 'Withdraw', action: () => navigate('/withdraw'), color: '#f6465d' },
    { icon: Repeat,        label: 'Transfer', action: () => navigate('/transfer'), color: '#1890ff' },
    { icon: Users,         label: 'Referral', action: () => navigate('/referral'), color: '#f0b90b' },
    { icon: Coins,         label: 'Listing',  action: () => navigate('/listing'),  color: '#722ed1' },
    { icon: Gift,          label: 'Support',  action: () => navigate('/support'),  color: '#13c2c2' },
  ];

  // Onboarding steps
  const steps = [
    { done: profileComplete, label: 'Complete Profile', action: '/profile', icon: User },
    { done: kycLevel > 0,    label: 'Verify KYC',       action: '/kyc',     icon: Shield },
  ];
  const allDone = steps.every(s => s.done);
  const nextStep = steps.find(s => !s.done);

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Balance */}
      <div style={{ background: 'var(--color-surface)', padding: '20px 16px 16px',
                    borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>Total Balance</span>
          <button onClick={() => setHideBalance(!hideBalance)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)'
          }}>
            {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-text)' }}>
            {hideBalance ? '****' : totalBalance}
          </span>
          <span style={{ fontSize: 15, color: 'var(--color-muted)' }}>USDT</span>
        </div>

        {/* Deposit / Complete Profile Button */}
        <button onClick={() => navigate(profileComplete ? '/deposit' : '/edit-profile')}
          style={{ width: '100%', padding: '14px', borderRadius: 12,
                   background: 'var(--color-primary)', border: 'none',
                   color: '#000', fontSize: 16, fontWeight: 700,
                   cursor: 'pointer', marginBottom: 16 }}>
          {profileComplete ? 'Deposit' : 'Complete Your Profile →'}
        </button>

        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {quickActions.map(({ icon: Icon, label, action, color }) => (
            <button key={label} onClick={action} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 12,
                            background: color + '20', display: 'flex',
                            alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={19} color={color} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Onboarding Banner */}
      {!allDone && (
        <div onClick={() => nextStep && navigate(nextStep.action)}
          style={{ margin: '12px 16px 0', padding: '14px 16px', borderRadius: 12,
                   cursor: 'pointer',
                   background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                   border: '1px solid rgba(240,185,11,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#f0b90b', marginBottom: 6 }}>
                Complete Your Account Setup
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {steps.map(({ done, label, icon: Icon }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {done
                      ? <CheckCircle size={14} color="#0ecb81" />
                      : <Icon size={14} color="#848e9c" />
                    }
                    <span style={{ fontSize: 12,
                                   color: done ? '#0ecb81' : '#848e9c',
                                   textDecoration: done ? 'line-through' : 'none' }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <ArrowRight size={20} color="#f0b90b" />
          </div>
          <div style={{ marginTop: 10, height: 3, borderRadius: 2,
                        background: 'rgba(255,255,255,0.1)' }}>
            <div style={{ height: '100%', borderRadius: 2, background: '#f0b90b',
                          width: `${(steps.filter(s => s.done).length / steps.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Promo Banner */}
      <div style={{ padding: '12px 16px' }}>
        <div onClick={() => navigate('/listing')} style={{
          borderRadius: 12, padding: '14px 16px',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          border: '1px solid var(--color-border)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
              🚀 List Your Token
            </div>
            <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 2 }}>
              Starting ₹50,000 only
            </div>
          </div>
          <ChevronRight size={18} color="var(--color-muted)" />
        </div>
      </div>

      {/* Markets */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
            Markets
          </span>
          <span onClick={() => navigate('/markets')}
            style={{ fontSize: 13, color: 'var(--color-primary)', cursor: 'pointer',
                     display: 'flex', alignItems: 'center', gap: 2 }}>
            All <ChevronRight size={14} />
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['hot','gainers','losers'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: activeTab === tab ? 'var(--color-primary)' : 'var(--color-surface2)',
              color: activeTab === tab ? '#000' : 'var(--color-muted)',
              fontSize: 12, fontWeight: activeTab === tab ? 700 : 400,
              textTransform: 'capitalize'
            }}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
          ))}
        </div>

        {/* Pairs */}
        {pairs.length === 0
          ? Array(5).fill(0).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center',
                                   padding: '12px 0', borderBottom: '1px solid var(--color-border)', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%',
                            background: 'var(--color-surface2)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: 80, height: 13, borderRadius: 4,
                              background: 'var(--color-surface2)', marginBottom: 5 }} />
                <div style={{ width: 60, height: 11, borderRadius: 4,
                              background: 'var(--color-surface2)' }} />
              </div>
              <div style={{ width: 70, height: 13, borderRadius: 4,
                            background: 'var(--color-surface2)' }} />
            </div>
          ))
          : getFilteredPairs().slice(0, 6).map(pair => {
            const live = prices[pair.symbol];
            const price = live?.price || pair.price;
            const change = parseFloat(live?.change_24h || pair.change_24h || 0);
            const isUp = change >= 0;

            return (
              <div key={pair.symbol}
                onClick={() => navigate('/trade/' + pair.symbol)}
                style={{ display: 'flex', alignItems: 'center',
                         justifyContent: 'space-between',
                         padding: '11px 0',
                         borderBottom: '1px solid var(--color-border)',
                         cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {pair.base_logo
                    ? <img src={pair.base_logo} alt={pair.base_symbol}
                        style={{ width: 36, height: 36, borderRadius: '50%' }}
                        onError={(e) => { (e.target as any).style.display = 'none'; }} />
                    : <div style={{ width: 36, height: 36, borderRadius: '50%',
                                    background: 'var(--color-surface2)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 700, color: 'var(--color-primary)', fontSize: 13 }}>
                        {pair.base_symbol?.charAt(0)}
                      </div>
                  }
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                      {pair.base_symbol}
                      <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: 12 }}>
                        /USDT
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 1 }}>
                      Vol ${(parseFloat(pair.volume_24h||0)/1000000).toFixed(1)}M
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                    ${parseFloat(price||0).toLocaleString(undefined,
                      { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                                padding: '2px 7px', borderRadius: 6, marginTop: 2,
                                background: isUp ? '#0ecb8118' : '#f6465d18',
                                color: isUp ? 'var(--color-success)' : 'var(--color-danger)',
                                fontSize: 11, fontWeight: 600 }}>
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
