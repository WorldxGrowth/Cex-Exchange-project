import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MessageCircle, Mail, FileText, ChevronRight, ExternalLink } from 'lucide-react';

export default function Support() {
  const navigate = useNavigate();

  const faqs = [
    { q: 'How do I deposit funds?', a: 'Go to Assets → Deposit → Select coin → Select network → Copy address and send from your wallet.' },
    { q: 'How long does withdrawal take?', a: 'Withdrawals are processed within 24 hours. Crypto withdrawals depend on network confirmation time.' },
    { q: 'How to complete KYC?', a: 'Go to Profile → KYC Verification → Fill form → Submit documents. Review takes 24-48 hours.' },
    { q: 'What is the trading fee?', a: 'Standard fee is 0.1% per trade. VIP users get reduced fees. Referrers earn 40% of referee fees.' },
    { q: 'How to list my token?', a: 'Go to Profile → List Your Token → Select package → Fill application form.' },
  ];

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', paddingBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>Support & Help</span>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Contact Options */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', fontWeight: 600,
                        textTransform: 'uppercase', marginBottom: 10 }}>Contact Us</div>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12,
                        border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            {[
              { icon: MessageCircle, label: 'Live Chat', sub: 'Chat with support team', action: () => window.open('https://t.me/vdexchange', '_blank'), color: '#1890ff' },
              { icon: Mail, label: 'Email Support', sub: 'support@vdexchange.com', action: () => window.location.href = 'mailto:support@vdexchange.com', color: '#0ecb81' },
              { icon: FileText, label: 'Documentation', sub: 'Read our guides', action: () => alert('Docs coming soon'), color: '#f0b90b' },
            ].map(({ icon: Icon, label, sub, action, color }, i) => (
              <div key={label} onClick={action}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                         cursor: 'pointer', borderBottom: i < 2 ? '1px solid var(--color-border)' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '20',
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{sub}</div>
                </div>
                <ExternalLink size={16} color="var(--color-muted)" />
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ fontSize: 13, color: 'var(--color-muted)', fontWeight: 600,
                      textTransform: 'uppercase', marginBottom: 10 }}>FAQ</div>
        <div style={{ background: 'var(--color-surface)', borderRadius: 12,
                      border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{ borderBottom: i < faqs.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <div onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>
                  {faq.q}
                </span>
                <ChevronRight size={16} color="var(--color-muted)"
                  style={{ transform: openFaq === i ? 'rotate(90deg)' : 'rotate(0deg)', transition: '0.2s' }} />
              </div>
              {openFaq === i && (
                <div style={{ padding: '0 16px 14px', fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6 }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* App version */}
        <div style={{ textAlign: 'center', marginTop: 24, color: 'var(--color-muted)', fontSize: 12 }}>
          VDExchange v1.0.0 · support@vdexchange.com
        </div>
      </div>
    </div>
  );
}
