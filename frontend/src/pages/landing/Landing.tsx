import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { marketAPI } from '../../services/api';
import { subscribeToTicker } from '../../services/socket';
import { TrendingUp, TrendingDown, ArrowRight, Zap,
         Shield, BarChart2, Wallet, Globe, ChevronRight } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const { isLoggedIn } = useStore();
  const [pairs, setPairs] = useState<any[]>([]);
  const [prices, setPricesLocal] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<'hot'|'gainers'|'losers'|'new'>('hot');
  const [footerPages, setFooterPages] = useState<any[]>([]);
  const [announcement, setAnnouncement] = useState<any>(null);

  // Redirect if logged in
  useEffect(() => {
    if (isLoggedIn) navigate('/home');
  }, [isLoggedIn]);

  // Load pairs
  useEffect(() => {
    marketAPI.getPairs().then((res: any) => {
      setPairs(res.data || []);
      res.data?.slice(0, 10).forEach((p: any) => {
        subscribeToTicker(p.symbol, (data: any) => {
          setPricesLocal(prev => ({ ...prev, [p.symbol]: data }));
        });
      });
    }).catch(() => {});

    // Footer pages
    fetch('/api/v1/market/pages/footer')
      .then(r => r.json())
      .then(d => setFooterPages(d.data || []))
      .catch(() => {});

    // Latest announcement
    fetch('/api/v1/market/announcements')
      .then(r => r.json())
      .then(d => {
        const anns = d.data || [];
        if (anns.length > 0) setAnnouncement(anns[0]);
      })
      .catch(() => {});
  }, []);

  const getFilteredPairs = () => {
    if (!pairs.length) return [];
    const withPrice = pairs.map(p => ({
      ...p,
      livePrice: prices[p.symbol]?.price || p.last_price || 0,
      change: parseFloat(prices[p.symbol]?.change_24h || p.change_24h || 0),
    }));
    if (activeTab === 'gainers') return [...withPrice].sort((a, b) => b.change - a.change).slice(0, 8);
    if (activeTab === 'losers')  return [...withPrice].sort((a, b) => a.change - b.change).slice(0, 8);
    if (activeTab === 'new')     return [...withPrice].slice(-8).reverse();
    return withPrice.slice(0, 8);
  };

  const s = {
    btn: (primary = true) => ({
      padding: '14px 32px', borderRadius: 12, border: 'none',
      background: primary ? 'var(--color-primary)' : 'var(--color-surface2)',
      color: primary ? '#000' : 'var(--color-text)',
      fontSize: 15, fontWeight: 700, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 8,
    } as React.CSSProperties),
  };

  return (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '100vh' }}>

      {/* ── HEADER ─────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 16px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          onClick={() => navigate('/')}>
          <div style={{ width: 32, height: 32, borderRadius: 8,
                        background: 'var(--color-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0 }}>
            <Zap size={18} color="#000" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-text)',
                         whiteSpace: 'nowrap' }}>
            VDExchange
          </span>
        </div>

        {/* Auth Buttons - Right side only */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => navigate('/login')} style={{
            padding: '8px 16px', borderRadius: 8,
            background: 'none', border: '1px solid var(--color-border)',
            color: 'var(--color-text)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap'
          }}>Log In</button>
          <button onClick={() => navigate('/register')} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: 'var(--color-primary)',
            color: '#000', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap'
          }}>Sign Up</button>
        </div>
      </header>

      {/* ── ANNOUNCEMENT BANNER ─────────────────── */}
      {announcement && (
        <div style={{
          background: 'linear-gradient(90deg, #f0b90b22, #f0b90b11)',
          borderBottom: '1px solid #f0b90b33',
          padding: '10px 20px', textAlign: 'center',
          fontSize: 13, color: 'var(--color-primary)', cursor: 'pointer'
        }}>
          📢 {announcement.title}
        </div>
      )}

      {/* ── HERO SECTION ─────────────────────────── */}
      <section style={{
        padding: '60px 20px 40px', textAlign: 'center',
        background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-bg) 100%)'
      }}>
        {/* Animated badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 20,
          background: '#f0b90b22', border: '1px solid #f0b90b44',
          marginBottom: 20, fontSize: 13, color: 'var(--color-primary)'
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%',
                         background: 'var(--color-primary)',
                         boxShadow: '0 0 8px var(--color-primary)',
                         display: 'inline-block' }} />
          Live Trading Platform
        </div>

        <h1 style={{
          fontSize: 'clamp(28px, 6vw, 52px)',
          fontWeight: 800, lineHeight: 1.15,
          color: 'var(--color-text)', marginBottom: 16,
          maxWidth: 680, margin: '0 auto 16px'
        }}>
          Trade Crypto with<br />
          <span style={{ color: 'var(--color-primary)' }}>Confidence & Speed</span>
        </h1>

        <p style={{
          fontSize: 16, color: 'var(--color-muted)',
          maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.6
        }}>
          Buy, sell, and trade 10+ cryptocurrencies with low fees,
          real-time prices, and bank-grade security.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center',
                      flexWrap: 'wrap', marginBottom: 48 }}>
          <button style={s.btn(true)} onClick={() => navigate('/register')}>
            Get Started <ArrowRight size={16} />
          </button>
          <button style={s.btn(false)} onClick={() => navigate('/markets')}>
            <BarChart2 size={16} /> View Markets
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', gap: 32, justifyContent: 'center',
          flexWrap: 'wrap', marginBottom: 48
        }}>
          {[
            ['10+', 'Cryptocurrencies'],
            ['0.1%', 'Trading Fee'],
            ['24/7', 'Support'],
            ['Fast', 'Withdrawals'],
          ].map(([val, label]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800,
                            color: 'var(--color-primary)' }}>{val}</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)',
                            marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── LIVE PAIRS ───────────────────────────── */}
      <section style={{ padding: '0 16px 40px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16,
                        background: 'var(--color-surface)',
                        borderRadius: 10, padding: 4,
                        border: '1px solid var(--color-border)' }}>
            {(['hot','gainers','losers','new'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none',
                background: activeTab === tab ? 'var(--color-primary)' : 'none',
                color: activeTab === tab ? '#000' : 'var(--color-muted)',
                fontSize: 13, fontWeight: activeTab === tab ? 700 : 400,
                cursor: 'pointer', textTransform: 'capitalize'
              }}>
                {tab === 'hot' ? '🔥 Hot' : tab === 'gainers' ? '📈 Gainers' :
                 tab === 'losers' ? '📉 Losers' : '🆕 New'}
              </button>
            ))}
          </div>

          {/* Pairs Table */}
          <div style={{ background: 'var(--color-surface)',
                        borderRadius: 12, border: '1px solid var(--color-border)',
                        overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 80px',
                          padding: '10px 16px',
                          borderBottom: '1px solid var(--color-border)',
                          color: 'var(--color-muted)', fontSize: 12 }}>
              <span>Pair</span>
              <span style={{ textAlign: 'right' }}>Price</span>
              <span style={{ textAlign: 'right' }}>24h Change</span>
              <span style={{ textAlign: 'right' }}>Trade</span>
            </div>

            {getFilteredPairs().length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center',
                            color: 'var(--color-muted)', fontSize: 14 }}>
                Loading markets...
              </div>
            ) : (
              getFilteredPairs().map((pair: any) => {
                const change = pair.change || 0;
                const isUp = change >= 0;
                return (
                  <div key={pair.symbol}
                    onClick={() => navigate('/login')}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1.5fr 1fr 80px',
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Symbol */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img
                        src={pair.base_logo || `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${pair.base_symbol?.toLowerCase()}.svg`}
                        width={28} height={28}
                        style={{ borderRadius: '50%' }}
                        onError={(e: any) => { e.target.src = `https://ui-avatars.com/api/?name=${pair.base_symbol}&size=28&background=f0b90b&color=000`; }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {pair.base_symbol}
                          <span style={{ color: 'var(--color-muted)',
                                         fontWeight: 400 }}>/USDT</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                          {pair.base_name || pair.base_symbol}
                        </div>
                      </div>
                    </div>

                    {/* Price */}
                    <div style={{ textAlign: 'right', fontWeight: 700,
                                  fontSize: 14, alignSelf: 'center' }}>
                      ${parseFloat(pair.livePrice || 0).toLocaleString(undefined,
                        { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </div>

                    {/* Change */}
                    <div style={{
                      textAlign: 'right', alignSelf: 'center',
                      fontWeight: 700, fontSize: 14,
                      color: isUp ? 'var(--color-success)' : 'var(--color-danger)',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'flex-end', gap: 3
                    }}>
                      {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {isUp ? '+' : ''}{change.toFixed(2)}%
                    </div>

                    {/* Trade Button */}
                    <div style={{ textAlign: 'right', alignSelf: 'center' }}>
                      <button onClick={e => { e.stopPropagation(); navigate('/login'); }}
                        style={{
                          padding: '5px 12px', borderRadius: 6, border: 'none',
                          background: 'var(--color-primary)', color: '#000',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer'
                        }}>
                        Trade
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* View All */}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={() => navigate('/login')} style={{
              padding: '10px 24px', borderRadius: 8,
              background: 'none', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', fontSize: 13, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6
            }}>
              View All Markets <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────── */}
      <section style={{ padding: '40px 20px',
                        background: 'var(--color-surface)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 800,
                       marginBottom: 8 }}>
            Why VDExchange?
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--color-muted)',
                      fontSize: 14, marginBottom: 36 }}>
            Built for traders who demand the best
          </p>

          <div style={{ display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 16 }}>
            {[
              { icon: <Shield size={24} />, title: 'Bank-Grade Security',
                desc: 'Multi-layer security with 2FA, cold storage, and real-time monitoring' },
              { icon: <BarChart2 size={24} />, title: 'Real-Time Trading',
                desc: 'Live order books, WebSocket price feeds, instant execution' },
              { icon: <Wallet size={24} />, title: 'Multi-Chain Support',
                desc: 'BSC, ETH, VDChain — deposit and withdraw on multiple networks' },
              { icon: <Globe size={24} />, title: 'Low Fees',
                desc: 'Start at 0.1% trading fee. Lower fees with higher VIP levels' },
            ].map(f => (
              <div key={f.title} style={{
                padding: 20, borderRadius: 12,
                background: 'var(--color-surface2)',
                border: '1px solid var(--color-border)'
              }}>
                <div style={{ color: 'var(--color-primary)', marginBottom: 10 }}>
                  {f.icon}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-muted)',
                              lineHeight: 1.5 }}>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ──────────────────────────── */}
      <section style={{ padding: '48px 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
          Ready to Start Trading?
        </h2>
        <p style={{ color: 'var(--color-muted)', fontSize: 14, marginBottom: 28 }}>
          Join VDExchange and trade your favorite cryptocurrencies today
        </p>
        <button style={s.btn(true)} onClick={() => navigate('/register')}>
          Create Free Account <ArrowRight size={16} />
        </button>
      </section>

      {/* ── FOOTER ───────────────────────────────── */}
      <footer style={{
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        padding: '32px 20px 20px'
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          {/* Footer Top */}
          <div style={{ display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 24, marginBottom: 28 }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                            marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6,
                              background: 'var(--color-primary)',
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'center' }}>
                  <Zap size={16} color="#000" />
                </div>
                <span style={{ fontWeight: 800, fontSize: 16 }}>VDExchange</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.6 }}>
                A fast and secure crypto exchange platform
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12,
                            color: 'var(--color-text)' }}>Platform</div>
              {[['Markets', '/markets'], ['Trade', '/trade'],
                ['Deposit', '/login'], ['Withdraw', '/login']].map(([label, path]) => (
                <a key={label} href={path} style={{
                  display: 'block', color: 'var(--color-muted)',
                  textDecoration: 'none', fontSize: 13,
                  marginBottom: 8, lineHeight: 1.4
                }}>{label}</a>
              ))}
            </div>

            {/* Legal Pages from CMS */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12,
                            color: 'var(--color-text)' }}>Legal</div>
              {footerPages.filter((p: any) => p.page_type === 'legal').map((page: any) => (
                <a key={page.slug} href={`/pages/${page.slug}`} style={{
                  display: 'block', color: 'var(--color-muted)',
                  textDecoration: 'none', fontSize: 13,
                  marginBottom: 8, lineHeight: 1.4
                }}>
                  {page.icon} {page.title}
                </a>
              ))}
            </div>

            {/* Info Pages from CMS */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12,
                            color: 'var(--color-text)' }}>Company</div>
              {footerPages.filter((p: any) => p.page_type !== 'legal').map((page: any) => (
                <a key={page.slug} href={`/pages/${page.slug}`} style={{
                  display: 'block', color: 'var(--color-muted)',
                  textDecoration: 'none', fontSize: 13,
                  marginBottom: 8, lineHeight: 1.4
                }}>
                  {page.icon} {page.title}
                </a>
              ))}
            </div>
          </div>

          {/* Footer Bottom */}
          <div style={{ borderTop: '1px solid var(--color-border)',
                        paddingTop: 16, display: 'flex',
                        justifyContent: 'space-between', flexWrap: 'wrap',
                        gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              © 2025 VDExchange. All rights reserved.
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              Powered by VDChain
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
