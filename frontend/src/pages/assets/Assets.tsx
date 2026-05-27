import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI } from '../../services/api';
import { ArrowDownLeft, ArrowUpRight, Repeat, Eye, EyeOff, Search } from 'lucide-react';

export default function Assets() {
  const navigate = useNavigate();
  const [balances, setBalances] = useState<any[]>([]);
  const [totalUsdt, setTotalUsdt] = useState('0.00');
  const [hideBalance, setHideBalance] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    walletAPI.getBalances().then((res: any) => {
      setBalances(res.data.balances || []);
      setTotalUsdt(parseFloat(res.data.total_usdt || 0).toFixed(2));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = balances.filter(b =>
    !search || b.symbol.toLowerCase().includes(search.toLowerCase()) ||
    b.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ paddingBottom: 20 }}>

      {/* Header */}
      <div style={{ background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '20px 16px' }}>
        <div style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 4,
                      display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Total Balance</span>
          <button onClick={() => setHideBalance(!hideBalance)}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
                     color: 'var(--color-muted)' }}>
            {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-text)' }}>
            {hideBalance ? '****' : totalUsdt}
          </span>
          <span style={{ fontSize: 15, color: 'var(--color-muted)' }}>USDT</span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { icon: ArrowDownLeft, label: 'Deposit',  path: '/deposit',  color: 'var(--color-success)' },
            { icon: ArrowUpRight,  label: 'Withdraw', path: '/withdraw', color: 'var(--color-danger)' },
            { icon: Repeat,        label: 'Transfer', path: '/transfer', color: 'var(--color-secondary)' },
          ].map(({ icon: Icon, label, path, color }) => (
            <button key={label} onClick={() => navigate(path)} style={{
              flex: 1, padding: '10px 8px', borderRadius: 10, border: 'none',
              background: 'var(--color-surface2)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
            }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%',
                            background: color + '20', display: 'flex',
                            alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={color} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--color-text)', fontWeight: 500 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%',
                                     transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
          <input placeholder="Search coin..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 10px 9px 32px', borderRadius: 20,
                     border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
                     color: 'var(--color-text)', fontSize: 13, outline: 'none' }} />
        </div>
      </div>

      {/* Balance List */}
      <div style={{ padding: '0 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
            <div style={{ color: 'var(--color-muted)', fontSize: 14 }}>No assets yet</div>
            <button onClick={() => navigate('/deposit')} style={{
              marginTop: 16, padding: '10px 24px', borderRadius: 8,
              background: 'var(--color-primary)', border: 'none',
              color: '#000', fontWeight: 700, cursor: 'pointer'
            }}>Deposit Now</button>
          </div>
        ) : filtered.map((b: any) => (
          <div key={b.symbol} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 0', borderBottom: '1px solid var(--color-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {b.logo_url
                ? <img src={b.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }}
                    onError={(e) => { (e.target as any).style.display = 'none'; }} />
                : <div style={{ width: 36, height: 36, borderRadius: '50%',
                                background: 'var(--color-surface2)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, color: 'var(--color-primary)', fontSize: 13 }}>
                    {b.symbol?.charAt(0)}
                  </div>
              }
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>{b.symbol}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{b.name}</div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                {hideBalance ? '****' : parseFloat(b.total).toFixed(6)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                ≈${hideBalance ? '****' : parseFloat(b.total_usdt_value || 0).toFixed(2)}
              </div>
              {parseFloat(b.locked) > 0 && (
                <div style={{ fontSize: 11, color: 'var(--color-warning)' }}>
                  Locked: {parseFloat(b.locked).toFixed(6)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
