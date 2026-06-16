import { useNavigate } from 'react-router-dom';
import { UserPlus, ArrowDownToLine, TrendingUp, ArrowRight } from 'lucide-react';

export default function StepsSection() {
  const navigate = useNavigate();
  const steps = [
    { num: '01', icon: UserPlus, color: '#f0b90b',
      title: 'Create Account',
      desc: 'Sign up in under 2 minutes with your email. No KYC required to start trading.' },
    { num: '02', icon: ArrowDownToLine, color: '#0ecb81',
      title: 'Deposit Funds',
      desc: 'Deposit USDT, BTC, ETH or VDC via multiple blockchain networks.' },
    { num: '03', icon: TrendingUp, color: '#1890ff',
      title: 'Start Trading',
      desc: 'Trade spot or futures with real-time charts, order book, and instant execution.' },
  ];

  return (
    <section style={{ padding: '64px 24px', background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
            Start Trading in 3 Steps
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: 15 }}>
            Get started in minutes, no experience needed
          </p>
        </div>

        <div style={{ display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: 24, position: 'relative' }}>
          {steps.map(({ num, icon: Icon, color, title, desc }, i) => (
            <div key={num} style={{ textAlign: 'center', position: 'relative' }}>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div style={{
                  position: 'absolute', top: 36, left: '65%',
                  width: '70%', height: 1,
                  background: 'linear-gradient(90deg, var(--color-border), transparent)',
                  display: window.innerWidth < 768 ? 'none' : 'block'
                }} />
              )}

              {/* Icon circle */}
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: color + '18',
                border: `2px solid ${color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', position: 'relative'
              }}>
                <Icon size={28} color={color} />
                <div style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 24, height: 24, borderRadius: '50%',
                  background: color, color: '#000',
                  fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>{num.slice(1)}</div>
              </div>

              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 14, color: 'var(--color-muted)',
                            lineHeight: 1.6, maxWidth: 240, margin: '0 auto' }}>{desc}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button onClick={() => navigate('/register')} style={{
            padding: '14px 32px', borderRadius: 12, border: 'none',
            background: 'var(--color-primary)', color: '#000',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8
          }}>
            Create Free Account <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
