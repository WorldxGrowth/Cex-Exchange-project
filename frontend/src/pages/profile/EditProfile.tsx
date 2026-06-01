import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../../services/api';
import { ArrowLeft, Check, ChevronRight, X, Search } from 'lucide-react';
import { Country, State, City } from 'country-state-city';
import toast from 'react-hot-toast';

// ── Bottom Sheet ──────────────────────────────────
const BottomSheet = ({ open, onClose, title, items, onSelect, searchable = true }: any) => {
  const [search, setSearch] = useState('');
  const filtered = searchable && search
    ? items.filter((i: any) => i.label.toLowerCase().includes(search.toLowerCase()))
    : items;

  useEffect(() => { if (!open) setSearch(''); }, [open]);
  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end'
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--color-surface)',
        borderRadius: '20px 20px 0 0',
        height: '70vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2,
                        background: 'var(--color-border)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 20px 12px', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'var(--color-surface2)', border: 'none',
            cursor: 'pointer', borderRadius: '50%',
            width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <X size={16} color="var(--color-muted)" />
          </button>
        </div>

        {/* Search - fixed, won't scroll */}
        {searchable && (
          <div style={{ padding: '0 16px 10px', flexShrink: 0,
                        borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                          background: 'var(--color-surface2)',
                          borderRadius: 12, padding: '10px 14px',
                          border: '1px solid var(--color-border)' }}>
              <Search size={15} color="var(--color-muted)" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                style={{ flex: 1, background: 'none', border: 'none',
                         color: 'var(--color-text)', fontSize: 15,
                         outline: 'none' }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-muted)', display: 'flex'
                }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scrollable list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.map((item: any) => (
            <div key={item.value}
              onClick={() => { onSelect(item); onClose(); }}
              style={{
                padding: '14px 20px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                borderBottom: '1px solid var(--color-border)'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {item.flag && <span style={{ fontSize: 22 }}>{item.flag}</span>}
              <span style={{ fontSize: 15, color: 'var(--color-text)' }}>{item.label}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center',
                          color: 'var(--color-muted)', fontSize: 14 }}>
              No results found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Row ───────────────────────────────────────────
const Row = ({ label, value, onClick, placeholder, readOnly = false, danger = false }: any) => (
  <div onClick={readOnly ? undefined : onClick}
    style={{
      display: 'flex', alignItems: 'center',
      padding: '15px 0',
      borderBottom: '1px solid var(--color-border)',
      cursor: readOnly ? 'default' : 'pointer'
    }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15,
                    color: value
                      ? (danger ? 'var(--color-danger)' : 'var(--color-text)')
                      : 'var(--color-muted)' }}>
        {value || placeholder}
      </div>
    </div>
    {!readOnly && <ChevronRight size={16} color="var(--color-muted)" />}
  </div>
);

// ── Main ──────────────────────────────────────────
export default function EditProfile() {
  const navigate  = useNavigate();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [inlineVal, setInlineVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<null|'country'|'state'|'city'|'gender'>(null);

  const [form, setForm] = useState({
    full_name:    '',
    date_of_birth:'',
    gender:       '',
    country_code: 'IN',
    state_code:   '',
    city_name:    '',
    street:       '',
    pincode:      '',
  });

  const [readOnly, setReadOnly] = useState({ email: '', phone: '' });

  const countries = Country.getAllCountries();
  const states    = form.country_code ? State.getStatesOfCountry(form.country_code) : [];
  const cities    = form.state_code
    ? City.getCitiesOfState(form.country_code, form.state_code) : [];

  const selectedCountry = Country.getCountryByCode(form.country_code);
  const selectedState   = form.state_code
    ? State.getStateByCodeAndCountry(form.state_code, form.country_code) : null;

  useEffect(() => {
    userAPI.getProfile().then((res: any) => {
      const p = res.data;
      setForm(prev => ({
        ...prev,
        full_name:     p.full_name     || '',
        date_of_birth: p.date_of_birth
          ? new Date(p.date_of_birth).toISOString().split('T')[0] : '',
        gender:        p.gender        || '',
        street:        p.address       || '',
        city_name:     p.city          || '',
        pincode:       p.pincode       || '',
      }));
      setReadOnly({ email: p.email || '', phone: p.phone || '' });
    }).catch(() => {});
  }, []);

  const openEdit = (field: string, current: string) => {
    setEditing(field);
    setInlineVal(current);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const saveEdit = () => {
    if (editing) {
      setForm(prev => ({ ...prev, [editing]: inlineVal }));
      setEditing(null);
    }
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error('Full name required'); return; }
    setLoading(true);
    try {
      await userAPI.updateProfile({
        full_name:     form.full_name,
        date_of_birth: form.date_of_birth || undefined,
        gender:        form.gender        || undefined,
        nationality:   selectedCountry?.name || undefined,
        address:       form.street        || undefined,
        state:         selectedState?.name || undefined,
        city:          form.city_name     || undefined,
        pincode:       form.pincode       || undefined,
      });
      toast.success('Profile saved!');
      navigate('/profile');
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally { setLoading(false); }
  };

  const inp = {
    flex: 1, padding: '12px 14px', borderRadius: 12,
    border: '1px solid var(--color-primary)',
    background: 'var(--color-surface2)',
    color: 'var(--color-text)', fontSize: 15,
    outline: 'none', minWidth: 0,
  };

  const InlineEdit = ({ field, label, type = 'text' }: any) => (
    editing === field ? (
      <div style={{ padding: '15px 0',
                    borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-primary)',
                      marginBottom: 6 }}>{label}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={inputRef} type={type} value={inlineVal}
            onChange={e => setInlineVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveEdit()}
            style={inp as any} />
          <button onClick={saveEdit} style={{
            padding: '0 18px', borderRadius: 12, border: 'none',
            background: 'var(--color-primary)', color: '#000',
            fontWeight: 700, cursor: 'pointer', flexShrink: 0
          }}>OK</button>
          <button onClick={() => setEditing(null)} style={{
            padding: '0 12px', borderRadius: 12, border: 'none',
            background: 'var(--color-surface2)', color: 'var(--color-muted)',
            cursor: 'pointer', flexShrink: 0
          }}>✕</button>
        </div>
      </div>
    ) : (
      <Row label={label}
        value={field === 'full_name' ? form.full_name
             : field === 'date_of_birth' ? form.date_of_birth
             : field === 'street' ? form.street
             : form.pincode}
        placeholder="Tap to enter"
        onClick={() => openEdit(field,
          field === 'full_name' ? form.full_name
        : field === 'date_of_birth' ? form.date_of_birth
        : field === 'street' ? form.street
        : form.pincode)} />
    )
  );

  const Section = ({ title }: any) => (
    <div style={{ paddingTop: 24, paddingBottom: 6,
                  fontSize: 12, color: 'var(--color-muted)',
                  fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: 0.5 }}>
      {title}
    </div>
  );

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh',
                  paddingBottom: 40 }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 20px', height: 56,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text)', display: 'flex'
        }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Basic Profile</span>
        <button onClick={handleSave} disabled={loading} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-primary)', fontSize: 15, fontWeight: 700
        }}>
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* Account */}
        <Section title="Account" />
        <Row label="Email" value={readOnly.email} readOnly />
        <div onClick={() => !readOnly.phone && navigate('/security')}
          style={{ display: 'flex', alignItems: 'center', padding: '15px 0',
                   borderBottom: '1px solid var(--color-border)',
                   cursor: readOnly.phone ? 'default' : 'pointer' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 3 }}>Phone</div>
            <div style={{ fontSize: 15,
                          color: readOnly.phone ? 'var(--color-text)' : 'var(--color-primary)' }}>
              {readOnly.phone || 'Bind phone number'}
            </div>
          </div>
          {!readOnly.phone && <ChevronRight size={16} color="var(--color-primary)" />}
        </div>

        {/* Personal */}
        <Section title="Personal" />
        <InlineEdit field="full_name" label="Full Name *" />
        <InlineEdit field="date_of_birth" label="Date of Birth" type="date" />
        <Row label="Gender"
          value={form.gender ? form.gender.charAt(0).toUpperCase() + form.gender.slice(1) : ''}
          placeholder="Select gender"
          onClick={() => setSheet('gender')} />

        {/* Address */}
        <Section title="Address" />
        <Row label="Country"
          value={selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : ''}
          placeholder="Select country"
          onClick={() => setSheet('country')} />
        <Row label="State / Province"
          value={selectedState?.name || ''}
          placeholder={states.length ? 'Select state' : 'Select country first'}
          onClick={() => states.length ? setSheet('state') : null} />
        <Row label="City"
          value={form.city_name}
          placeholder={cities.length ? 'Select city' : 'Select state first'}
          onClick={() => cities.length ? setSheet('city') : null} />
        <InlineEdit field="street" label="Street Address" />
        <InlineEdit field="pincode" label="PIN Code" />

        {/* Save */}
        <button onClick={handleSave} disabled={loading} style={{
          width: '100%', padding: 16, borderRadius: 14, border: 'none',
          marginTop: 28,
          background: loading ? 'var(--color-surface2)' : 'var(--color-primary)',
          color: loading ? 'var(--color-muted)' : '#000',
          fontSize: 16, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer'
        }}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Bottom Sheets */}
      <BottomSheet open={sheet === 'gender'} onClose={() => setSheet(null)}
        title="Select Gender" searchable={false}
        items={[
          { value: 'male',   label: '👨 Male' },
          { value: 'female', label: '👩 Female' },
          { value: 'other',  label: '🧑 Other / Prefer not to say' },
        ]}
        onSelect={(item: any) => setForm({ ...form, gender: item.value })}
      />
      <BottomSheet open={sheet === 'country'} onClose={() => setSheet(null)}
        title="Select Country"
        items={countries.map(c => ({ value: c.isoCode, label: c.name, flag: c.flag }))}
        onSelect={(item: any) =>
          setForm({ ...form, country_code: item.value, state_code: '', city_name: '' })}
      />
      <BottomSheet open={sheet === 'state'} onClose={() => setSheet(null)}
        title="Select State"
        items={states.map(s => ({ value: s.isoCode, label: s.name }))}
        onSelect={(item: any) =>
          setForm({ ...form, state_code: item.value, city_name: '' })}
      />
      <BottomSheet open={sheet === 'city'} onClose={() => setSheet(null)}
        title="Select City"
        items={cities.map(c => ({ value: c.name, label: c.name }))}
        onSelect={(item: any) => setForm({ ...form, city_name: item.value })}
      />
    </div>
  );
}
