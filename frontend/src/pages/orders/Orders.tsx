import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderAPI } from '../../services/api';
import { ChevronLeft } from 'lucide-react';

export default function Orders() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'open'|'history'>('open');
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [period, setPeriod] = useState('30D');
  const [showPeriod, setShowPeriod] = useState(false);

  useEffect(() => {
    orderAPI.getOpen().then((res: any) => setOpenOrders(res.data || []));
    orderAPI.getHistory().then((res: any) => {
      setHistory(res.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const statusColor: any = {
    filled: 'var(--color-success)',
    cancelled: 'var(--color-muted)',
    open: 'var(--color-primary)',
    partial: 'var(--color-warning)'
  };

  return (
    <div style={{ background:'var(--color-bg)', minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                    background:'var(--color-surface)',
                    borderBottom:'1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background:'none', border:'none',
                 cursor:'pointer', color:'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight:700, fontSize:17, color:'var(--color-text)' }}>Orders</span>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', background:'var(--color-surface)',
                    borderBottom:'1px solid var(--color-border)' }}>
        {(['open','history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex:1, padding:'12px', background:'none', border:'none', cursor:'pointer',
            color: tab===t ? 'var(--color-primary)' : 'var(--color-muted)',
            borderBottom: tab===t ? '2px solid var(--color-primary)' : '2px solid transparent',
            fontSize:14, fontWeight: tab===t ? 600 : 400
          }}>
            {t === 'open' ? `Open orders (${openOrders.length})` : 'Order history'}
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'10px 16px', borderBottom:'1px solid var(--color-border)' }}>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{
          background:'var(--color-surface2)', border:'1px solid var(--color-border)',
          color:'var(--color-text)', borderRadius:8, padding:'6px 12px', fontSize:13,
          outline:'none'
        }}>
          <option value="all">All</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>

        {tab === 'history' && (
          <button onClick={() => setShowPeriod(true)} style={{
            background:'none', border:'none', cursor:'pointer',
            color:'var(--color-muted)', fontSize:13,
            display:'flex', alignItems:'center', gap:4
          }}>
            🕐 {period}
          </button>
        )}
      </div>

      {/* Period Picker Modal */}
      {showPeriod && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
                      zIndex:200, display:'flex', alignItems:'flex-end' }}
             onClick={() => setShowPeriod(false)}>
          <div style={{ background:'var(--color-surface)', width:'100%', padding:'20px',
                        borderRadius:'16px 16px 0 0' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:18, fontWeight:700, color:'var(--color-text)', marginBottom:6 }}>
              Select period
            </div>
            <div style={{ fontSize:13, color:'var(--color-muted)', marginBottom:16 }}>
              Only data from the last 90 days is displayed.
            </div>
            <div style={{ display:'flex', gap:10, marginBottom:20 }}>
              {['7D','30D','3M'].map(p => (
                <button key={p} onClick={() => { setPeriod(p); setShowPeriod(false); }} style={{
                  flex:1, padding:'12px', borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:600,
                  background: period===p ? 'var(--color-surface2)' : 'none',
                  border: `1px solid ${period===p ? 'var(--color-text)' : 'var(--color-border)'}`,
                  color:'var(--color-text)'
                }}>{p}</button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <button onClick={() => setShowPeriod(false)} style={{
                padding:'13px', borderRadius:10, border:'1px solid var(--color-border)',
                background:'var(--color-surface2)', color:'var(--color-text)',
                cursor:'pointer', fontSize:14, fontWeight:600
              }}>Reset</button>
              <button onClick={() => setShowPeriod(false)} style={{
                padding:'13px', borderRadius:10, border:'none',
                background:'var(--color-text)', color:'var(--color-bg)',
                cursor:'pointer', fontSize:14, fontWeight:700
              }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Orders List */}
      <div style={{ paddingBottom:20 }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--color-muted)' }}>Loading...</div>
        ) : (

          (tab === 'open' ? openOrders : history)
            .filter(o => filter === 'all' || o.side === filter)
            .map((o: any) => (
            <div key={o.order_id} style={{ padding:'14px 16px',
                                           borderBottom:'1px solid var(--color-border)' }}>
              {/* Row 1 */}
              <div style={{ display:'flex', alignItems:'center',
                            justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ padding:'2px 10px', borderRadius:4, fontSize:12, fontWeight:700,
                                 background: o.side==='buy' ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)',
                                 color: o.side==='buy' ? 'var(--color-success)' : 'var(--color-danger)',
                                 textTransform:'capitalize' }}>{o.side}</span>
                  <span style={{ fontSize:15, fontWeight:700, color:'var(--color-text)' }}>
                    {o.pair_symbol}
                  </span>
                  <span style={{ fontSize:12, color:'var(--color-muted)' }}>
                    {new Date(o.created_at).toLocaleDateString('en',
                      {month:'2-digit',day:'2-digit'})} {new Date(o.created_at).toLocaleTimeString([],
                      {hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                  </span>
                </div>
                <span style={{ fontSize:13, fontWeight:600,
                               color: statusColor[o.status] || 'var(--color-muted)',
                               textTransform:'capitalize' }}>
                  {o.status?.charAt(0).toUpperCase() + o.status?.slice(1)}
                </span>
              </div>

              {/* Details */}
              {[
                { label:'Price (USDT)', value: parseFloat(o.price||0).toLocaleString(undefined,{minimumFractionDigits:2}) },
                { label:`Amount (${o.base_symbol||''})`, value: parseFloat(o.quantity||0).toFixed(5) },
                { label:'Total (USDT)', value: parseFloat(o.total_value||0).toLocaleString(undefined,{minimumFractionDigits:4}) },
                { label:'Filled price', value: parseFloat(o.filled_price||o.price||0).toLocaleString(undefined,{minimumFractionDigits:2}) },
                { label:`Filled (${o.base_symbol||''})`, value: parseFloat(o.filled_qty||0).toFixed(5) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between',
                                          padding:'3px 0', fontSize:13 }}>
                  <span style={{ color:'var(--color-muted)' }}>{label}</span>
                  <span style={{ color:'var(--color-text)', fontWeight:500 }}>{value}</span>
                </div>
              ))}
            </div>
          ))
        )}

        {!loading && (tab === 'open' ? openOrders : history).length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
            <div style={{ color:'var(--color-muted)', fontSize:14 }}>No orders found</div>
          </div>
        )}
      </div>
    </div>
  );
}
