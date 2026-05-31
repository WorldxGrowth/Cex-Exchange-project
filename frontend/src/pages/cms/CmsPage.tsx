import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';

export default function CmsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [footerPages, setFooterPages] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/market/pages/${slug}`)
      .then(r => r.json())
      .then(d => { setPage(d.data); setLoading(false); })
      .catch(() => { setLoading(false); });

    fetch('/api/v1/market/pages/footer')
      .then(r => r.json())
      .then(d => setFooterPages(d.data || []))
      .catch(() => {});
  }, [slug]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-muted)' }}>
      Loading...
    </div>
  );

  if (!page) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>404</div>
      <div style={{ color: 'var(--color-muted)' }}>Page not found</div>
      <button onClick={() => navigate('/')} style={{
        padding: '10px 20px', borderRadius: 8, border: 'none',
        background: 'var(--color-primary)', color: '#000',
        fontWeight: 700, cursor: 'pointer'
      }}>Go Home</button>
    </div>
  );

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh',
                  color: 'var(--color-text)' }}>

      {/* Header */}
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 20px', height: 60,
        display: 'flex', alignItems: 'center', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                      cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ width: 28, height: 28, borderRadius: 6,
                        background: 'var(--color-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="#000" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>VDExchange</span>
        </div>
      </header>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-bg) 100%)',
        padding: '40px 20px 32px', textAlign: 'center'
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{page.icon}</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{page.title}</h1>
        {page.subtitle && (
          <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>{page.subtitle}</p>
        )}
        <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 8 }}>
          Last updated: {new Date(page.updated_at).toLocaleDateString()}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 16, padding: '28px 28px',
          border: '1px solid var(--color-border)',
          lineHeight: 1.8, fontSize: 15,
          color: 'var(--color-text)'
        }}
          dangerouslySetInnerHTML={{ __html: page.content || '' }}
        />
      </div>

      {/* Footer */}
      <footer style={{
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        padding: '20px', textAlign: 'center'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center',
                      gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
          {footerPages.map((p: any) => (
            <a key={p.slug} href={`/pages/${p.slug}`} style={{
              color: 'var(--color-muted)', fontSize: 12, textDecoration: 'none'
            }}>
              {p.title}
            </a>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          © 2025 VDExchange. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
