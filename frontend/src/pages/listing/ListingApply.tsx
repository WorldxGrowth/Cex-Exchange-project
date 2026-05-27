import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listingAPI } from '../../services/api';
import { ChevronLeft, ChevronRight, Rocket, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ListingApply() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [step, setStep] = useState<'packages'|'form'|'success'>('packages');
  const [loading, setLoading] = useState(false);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [form, setForm] = useState({
    token_name: '', token_symbol: '', contract_address: '',
    network_id: 1, website: '', telegram: '', twitter: '',
    description: '', total_supply: '', initial_price: '',
    liquidity_token: '', liquidity_usdt: '', listing_date: ''
  });

  useEffect(() => {
    listingAPI.getPackages().then((res: any) => setPackages(res.data?.packages || []));
    listingAPI.getMyListings().then((res: any) => setMyListings(res.data || []));
  }, []);

  const handleSubmit = async () => {
    if (!form.token_name || !form.token_symbol) {
      toast.error('Token name and symbol required'); return;
    }
    setLoading(true);
    try {
      await listingAPI.apply({ ...form, listing_package: selected });
      toast.success('Application submitted!');
      setStep('success');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit');
    } finally { setLoading(false); }
  };

  const inp: any = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box'
  };

  const pkgColors: any = { basic: '#1890ff', premium: '#f0b90b', enterprise: '#722ed1' };

  if (step === 'success') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', padding: 20, background: 'var(--color-bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
                      background: 'rgba(14,203,129,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={40} color="var(--color-success)" />
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
          Application Submitted!
        </div>
        <div style={{ color: 'var(--color-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          We'll review your application and contact you within 48 hours.
          Check your email for payment instructions.
        </div>
        <button onClick={() => navigate('/home')} style={{
          padding: '12px 32px', borderRadius: 10,
          background: 'var(--color-primary)', border: 'none',
          color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 15
        }}>Back to Home</button>
      </div>
    </div>
  );

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', paddingBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => step === 'packages' ? navigate(-1) : setStep('packages')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
          {step === 'packages' ? 'List Your Token' : 'Application Form'}
        </span>
      </div>

      {step === 'packages' && (
        <div style={{ padding: '16px' }}>
          {/* Hero */}
          <div style={{ textAlign: 'center', padding: '20px 0 24px' }}>
            <Rocket size={48} color="var(--color-primary)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', marginBottom: 8 }}>
              List on VDExchange
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.6 }}>
              Reach thousands of traders. Choose your listing package.
            </div>
          </div>

          {/* Packages */}
          {packages.map((pkg: any) => (
            <div key={pkg.id} onClick={() => setSelected(pkg.id)}
              style={{ padding: '16px', borderRadius: 14, marginBottom: 12, cursor: 'pointer',
                       border: `2px solid ${selected === pkg.id ? pkgColors[pkg.id] : 'var(--color-border)'}`,
                       background: selected === pkg.id ? pkgColors[pkg.id] + '10' : 'var(--color-surface)',
                       transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
                    {pkg.name}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: pkgColors[pkg.id], marginTop: 4 }}>
                    ₹{pkg.price?.toLocaleString()}
                  </div>
                </div>
                <div style={{ width: 24, height: 24, borderRadius: '50%',
                              border: `2px solid ${selected === pkg.id ? pkgColors[pkg.id] : 'var(--color-border)'}`,
                              background: selected === pkg.id ? pkgColors[pkg.id] : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selected === pkg.id && <Check size={14} color="#fff" />}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {pkg.features?.map((f: string) => (
                  <div key={f} style={{ fontSize: 12, color: 'var(--color-muted)',
                                         display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--color-success)' }}>✓</span> {f}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* My listings */}
          {myListings.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 10, fontSize: 14 }}>
                My Applications
              </div>
              {myListings.map((l: any) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between',
                                          padding: '12px 14px', borderRadius: 10, marginBottom: 8,
                                          background: 'var(--color-surface)',
                                          border: '1px solid var(--color-border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{l.token_symbol}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{l.listing_package}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                                  background: l.status === 'live' ? 'rgba(14,203,129,0.15)' :
                                              l.status === 'approved' ? 'rgba(24,144,255,0.15)' :
                                              'rgba(240,185,11,0.15)',
                                  color: l.status === 'live' ? 'var(--color-success)' :
                                         l.status === 'approved' ? '#1890ff' : 'var(--color-warning)',
                                  alignSelf: 'center' }}>
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => { if (!selected) { toast.error('Select a package'); return; } setStep('form'); }}
            style={{ width: '100%', padding: '14px', borderRadius: 12, marginTop: 20,
                     background: selected ? 'var(--color-primary)' : 'var(--color-border)',
                     border: 'none', color: selected ? '#000' : 'var(--color-muted)',
                     fontWeight: 700, cursor: selected ? 'pointer' : 'not-allowed', fontSize: 15 }}>
            Continue →
          </button>
        </div>
      )}

      {step === 'form' && (
        <div style={{ padding: '16px' }}>
          <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 20,
                        background: pkgColors[selected] + '15',
                        border: `1px solid ${pkgColors[selected]}30` }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: pkgColors[selected] }}>
              {packages.find(p => p.id === selected)?.name} - ₹{packages.find(p => p.id === selected)?.price?.toLocaleString()}
            </span>
          </div>

          {/* Form Fields */}
          {[
            { key: 'token_name', label: 'Token Name *', placeholder: 'e.g. My Token' },
            { key: 'token_symbol', label: 'Token Symbol *', placeholder: 'e.g. MTK' },
            { key: 'contract_address', label: 'Contract Address', placeholder: '0x...' },
            { key: 'website', label: 'Website', placeholder: 'https://...' },
            { key: 'telegram', label: 'Telegram', placeholder: 'https://t.me/...' },
            { key: 'twitter', label: 'Twitter', placeholder: 'https://twitter.com/...' },
            { key: 'total_supply', label: 'Total Supply', placeholder: 'e.g. 100000000' },
            { key: 'initial_price', label: 'Initial Price (USDT)', placeholder: 'e.g. 0.001' },
            { key: 'liquidity_usdt', label: 'Liquidity (USDT)', placeholder: 'Min $500' },
          ].map(field => (
            <div key={field.key} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>{field.label}</div>
              <input value={(form as any)[field.key]}
                onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                placeholder={field.placeholder} style={inp} />
            </div>
          ))}

          {/* Network */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>Network *</div>
            <select value={form.network_id}
              onChange={e => setForm({ ...form, network_id: parseInt(e.target.value) })}
              style={inp}>
              <option value={1}>BNB Smart Chain (BSC)</option>
              <option value={2}>Ethereum</option>
              <option value={4}>VDChain</option>
            </select>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>Description</div>
            <textarea value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Describe your token project..." rows={3}
              style={{ ...inp, resize: 'none' }} />
          </div>

          {/* Listing Date */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>Preferred Listing Date</div>
            <input type="datetime-local" value={form.listing_date}
              onChange={e => setForm({ ...form, listing_date: e.target.value })}
              style={inp} />
          </div>

          <button onClick={handleSubmit} disabled={loading} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: loading ? 'var(--color-border)' : 'var(--color-primary)',
            color: '#000', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15
          }}>
            {loading ? 'Submitting...' : '🚀 Submit Application'}
          </button>
        </div>
      )}
    </div>
  );
}
