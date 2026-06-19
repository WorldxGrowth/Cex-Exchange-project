import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Headphones } from 'lucide-react';
import { futuresAPI } from '../../services/api';

export default function FuturesOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    futuresAPI.getOrderDetail(parseInt(id)).then((res: any) => {
      setOrder(res?.data || res);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const copyId = () => {
    if (order?.id) navigator.clipboard.writeText(String(order.id));
  };

  const fmt = (v: any, d = 2) => v != null ? parseFloat(v).toFixed(d) : '--';
  const fmtDate = (v: any) => v ? new Date(v).toLocaleString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).replace(',', '') : '--';

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}>
        Loading...
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}>
        Order not found
      </div>
    );
  }

  const isFilled = order.status === 'filled';
  const sideLabel = order.side === 'buy' ? 'Buy' : 'Sell';
  const typeLabel = order.order_type === 'market' ? 'Market'
    : order.order_type === 'limit' ? 'Limit'
    : order.order_type === 'stop_market' ? 'Market (Triggered)'
    : order.order_type === 'take_profit_market' ? 'Take Profit'
    : order.order_type;
  const fillPct = order.quantity > 0
    ? Math.round((parseFloat(order.filled_qty||0) / parseFloat(order.quantity||1)) * 100)
    : 0;

  const row = (label: string, value: any, color?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: color || 'var(--color-text)' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={22} color="var(--color-text)" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{order.symbol}</span>
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4,
                         background: 'rgba(255,255,255,0.08)', color: 'var(--color-muted)' }}>Perp</span>
        </div>
        <Headphones size={20} color="var(--color-muted)" />
      </div>

      {/* Status circle */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '28px 16px 20px' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%',
                      border: `2px solid ${isFilled ? 'var(--color-success)' : 'var(--color-muted)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 26, color: isFilled ? 'var(--color-success)' : 'var(--color-muted)' }}>
            {isFilled ? '✓' : order.status === 'cancelled' ? '✕' : '…'}
          </span>
        </div>
        <span style={{ fontSize: 16, fontWeight: 700,
                       color: isFilled ? 'var(--color-success)' : 'var(--color-muted)' }}>
          {isFilled ? `Filled(${fillPct}%)` : order.status?.charAt(0).toUpperCase()+order.status?.slice(1)}
        </span>
      </div>

      <div style={{ padding: '0 16px' }}>
        {row('Order No.', <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {order.id} <Copy size={13} style={{ cursor: 'pointer' }} onClick={copyId} />
        </span>)}
        {row('Type', `${typeLabel} / ${sideLabel}`,
          order.side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)')}
        {row('Filled/Amount', `${fmt(order.filled_qty,4)} / ${fmt(order.quantity,4)}`)}
        {row('Avg./Price', `${order.avg_fill_price ? fmt(order.avg_fill_price) : '--'} / ${order.order_type==='market'?'Market':fmt(order.price)}`)}
        {order.reduce_only && row('Reduce Only', 'True')}
        {row('Status', order.status?.charAt(0).toUpperCase()+order.status?.slice(1),
          order.status==='filled' ? 'var(--color-success)' : order.status==='cancelled' ? 'var(--color-danger)' : undefined)}

        <div style={{ height: 12 }} />

        {row('Fee', `${fmt(order.fee,6)} USDT`)}
        {row('Realized PNL',
          `${parseFloat(order.trade_pnl||0) >= 0 ? '' : ''}${fmt(order.trade_pnl,6)} USDT`,
          parseFloat(order.trade_pnl||0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)')}
        {row('Time Created', fmtDate(order.created_at))}
        {row('Time Updated', fmtDate(order.updated_at))}

        <div style={{ fontSize: 15, fontWeight: 700, margin: '20px 0 8px' }}>Trade Details</div>
        {row('Date', fmtDate(order.filled_at || order.created_at))}
        {row('Quantity', fmt(order.filled_qty,4))}
        {row('Price', order.avg_fill_price ? fmt(order.avg_fill_price) : '--')}
        {row('Realized PNL', `${fmt(order.trade_pnl,6)} USDT`,
          parseFloat(order.trade_pnl||0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)')}
        {row('Fee', `${fmt(order.trade_fee || order.fee,6)} USDT`)}
        {row('Role', order.is_maker ? 'Maker' : 'Taker')}
      </div>
      <div style={{ height: 40 }} />
    </div>
  );
}
