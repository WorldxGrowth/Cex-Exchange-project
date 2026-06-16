import { Shield, Zap, Wallet, Globe, BarChart2, Lock } from 'lucide-react';

export default function FeaturesSection() {
  const features = [
    { icon: Shield, color: '#0ecb81',
      title: 'Bank-Grade Security',
      desc: 'Multi-layer 2FA, cold storage, withdrawal locks, and real-time threat monitoring.' },
    { icon: Zap, color: '#f0b90b',
      title: 'Lightning Fast',
      desc: 'WebSocket live prices, instant order matching, and sub-second execution speed.' },
    { icon: Wallet, color: '#1890ff',
      title: 'Multi-Chain Support',
      desc: 'Deposit and withdraw on BSC, Ethereum, VDChain, TRON and more networks.' },
    { icon: Globe, color: '#722ed1',
      title: 'Low Trading Fees',
      desc: 'Start at just 0.1% per trade. Unlock lower fees as you reach higher VIP levels.' },
    { icon: BarChart2, color: '#13c2c2',
      title: 'Advanced Charts',
      desc: 'Professional candlestick charts with EMA, MACD, Bollinger Bands and more.' },
    { icon: Lock, color: '#f6465d',
      title: 'Secure Withdrawals',
      desc: '24-hour withdrawal lock after security changes. Idempotency protection built-in.' },
  ];

  return (
    <section style={{ padding: '64px 24px',
                      background: 'var(--color-surface)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
            Why Choose VDExchange?
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: 15 }}>
            Built for traders who demand the best
          </p>
        </div>

        <div style={{ display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: 20 }}>
          {features.map(({ icon: Icon, color, title, desc }) => (
            <div key={title} style={{
              padding: '24px',
              background: 'var(--color-bg)',
              borderRadius: 16,
              border: '1px solid var(--color-border)',
              transition: 'border-color 0.2s, transform 0.2s'
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = color;
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                (e.currentTarget as HTMLElement).style.transform = 'none';
              }}>
              <div style={{ width: 48, height: 48, borderRadius: 12,
                            background: color + '18',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', marginBottom: 16 }}>
                <Icon size={24} color={color} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 16,
                            marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 14, color: 'var(--color-muted)',
                            lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
