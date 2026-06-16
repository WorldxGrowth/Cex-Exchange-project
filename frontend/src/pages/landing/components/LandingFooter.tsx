import { Zap, X as XIcon, Send } from 'lucide-react';

interface Props {
  footerPages: any[];
}

export default function LandingFooter({ footerPages }: Props) {
  return (
    <footer style={{
      background: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)',
      padding: '48px 24px 24px'
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 32, marginBottom: 40 }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8,
                            background: 'var(--color-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={17} color="#000" />
              </div>
              <span style={{ fontWeight: 800, fontSize: 17 }}>VDExchange</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-muted)',
                        lineHeight: 1.6, marginBottom: 16 }}>
              A fast, secure, and low-fee crypto exchange built on VDChain technology.
            </p>
            {/* Social links */}
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { icon: XIcon, label: 'Twitter', href: '#' },
                { icon: Send,    label: 'Telegram', href: '#' },
              ].map(({ icon: Icon, label, href }) => (
                <a key={label} href={href} title={label}
                  style={{ width: 34, height: 34, borderRadius: 8,
                           background: 'var(--color-surface2)',
                           border: '1px solid var(--color-border)',
                           display: 'flex', alignItems: 'center', justifyContent: 'center',
                           color: 'var(--color-muted)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}>
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14,
                          color: 'var(--color-text)', textTransform: 'uppercase',
                          letterSpacing: 0.5 }}>Platform</div>
            {[['Markets', '/markets'], ['Trade', '/trade'],
              ['Futures', '/futures'], ['Deposit', '/login'],
              ['Withdraw', '/login']].map(([label, path]) => (
              <a key={label} href={path} style={{
                display: 'block', color: 'var(--color-muted)',
                textDecoration: 'none', fontSize: 14,
                marginBottom: 10, lineHeight: 1.4
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-muted)')}>
                {label}
              </a>
            ))}
          </div>

          {/* Legal */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14,
                          color: 'var(--color-text)', textTransform: 'uppercase',
                          letterSpacing: 0.5 }}>Legal</div>
            {footerPages.filter((p: any) => p.page_type === 'legal').map((page: any) => (
              <a key={page.slug} href={`/pages/${page.slug}`} style={{
                display: 'block', color: 'var(--color-muted)',
                textDecoration: 'none', fontSize: 14, marginBottom: 10
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-muted)')}>
                {page.icon} {page.title}
              </a>
            ))}
            {footerPages.filter((p: any) => p.page_type === 'legal').length === 0 && (
              <>
                {[['Privacy Policy', '#'], ['Terms of Service', '#'],
                  ['Cookie Policy', '#']].map(([label, href]) => (
                  <a key={label} href={href} style={{
                    display: 'block', color: 'var(--color-muted)',
                    textDecoration: 'none', fontSize: 14, marginBottom: 10
                  }}>{label}</a>
                ))}
              </>
            )}
          </div>

          {/* Company */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14,
                          color: 'var(--color-text)', textTransform: 'uppercase',
                          letterSpacing: 0.5 }}>Company</div>
            {footerPages.filter((p: any) => p.page_type !== 'legal').map((page: any) => (
              <a key={page.slug} href={`/pages/${page.slug}`} style={{
                display: 'block', color: 'var(--color-muted)',
                textDecoration: 'none', fontSize: 14, marginBottom: 10
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-muted)')}>
                {page.icon} {page.title}
              </a>
            ))}
            {footerPages.filter((p: any) => p.page_type !== 'legal').length === 0 && (
              <>
                {[['About Us', '#'], ['Blog', '#'], ['Contact', '#']].map(([label, href]) => (
                  <a key={label} href={href} style={{
                    display: 'block', color: 'var(--color-muted)',
                    textDecoration: 'none', fontSize: 14, marginBottom: 10
                  }}>{label}</a>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Bottom */}
        <div style={{ borderTop: '1px solid var(--color-border)',
                      paddingTop: 20, display: 'flex',
                      justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            © 2025 VDExchange. All rights reserved.
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            Powered by <span style={{ color: 'var(--color-primary)' }}>VDChain</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
