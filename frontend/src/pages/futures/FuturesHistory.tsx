import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, MoreHorizontal, Filter, ChevronRight } from 'lucide-react';
import { futuresAPI } from '../../services/api';

const TOP_TABS = [
  { key: 'open',     label: 'Open Orders' },
  { key: 'orders',   label: 'Order History' },
  { key: 'positions',label: 'Position History' },
  { key: 'trades',   label: 'Trade History' },
  { key: 'tx',       label: 'Transaction History' },
  { key: 'funding',  label: 'Funding Fee' },
];

const STATUS_OPTS  = ['All', 'Filled', 'Cancelled', 'Open'];
const DIRECTION_OPTS = ['All', 'Buy', 'Sell'];
const TYPE_OPTS    = ['All', 'Market', 'Limit', 'Stop Market', 'Take Profit Market'];
const SYMBOL_OPTS  = ['All', 'BTCUSDT', 'ETHUSDT', 'VDCUSDT'];
const DATE_OPTS    = ['Today', 'Last 7 days', 'Last 30 days', 'Last 3 months', 'This month'];
const POS_MODE_OPTS  = ['All', 'Long', 'Short'];
const POS_STATUS_OPTS = ['All', 'Closed', 'Liquidated'];

function FilterSheet({ title, options, value, onSelect, onClose }: any) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                  zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', borderRadius: '16px 16px 0 0',
                    padding: '16px 0 24px', width: '100%', maxWidth: 480 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-border)',
                      margin: '0 auto 14px' }} />
        <div style={{ fontWeight: 700, fontSize: 15, padding: '0 18px 12px' }}>{title}</div>
        {options.map((opt: string) => (
          <div key={opt} onClick={() => { onSelect(opt); onClose(); }}
            style={{ padding: '13px 18px', fontSize: 14, cursor: 'pointer',
                     color: value === opt ? 'var(--color-primary)' : 'var(--color-text)',
                     fontWeight: value === opt ? 700 : 400,
                     display: 'flex', justifyContent: 'space-between' }}>
            {opt} {value === opt && '✓'}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterBar({ filters }: { filters: { key: string; label: string; value: string; options: string[]; onChange: (v: string) => void }[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const active = filters.find(f => f.key === openKey);
  return (
    <>
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', overflowX: 'auto' }}>
        {filters.map(f => (
          <button key={f.key} onClick={() => setOpenKey(f.key)}
            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                     border: '1px solid var(--color-border)',
                     background: f.value !== 'All' ? 'rgba(240,185,11,0.12)' : 'var(--color-surface2)',
                     color: f.value !== 'All' ? 'var(--color-primary)' : 'var(--color-text)',
                     whiteSpace: 'nowrap', cursor: 'pointer',
                     display: 'flex', alignItems: 'center', gap: 4 }}>
            {f.value === 'All' ? f.label : f.value} ▾
          </button>
        ))}
        <button style={{ marginLeft: 'auto', background: 'none', border: 'none',
                         color: 'var(--color-muted)', cursor: 'pointer', flexShrink: 0 }}>
          <Filter size={18} />
        </button>
      </div>
      {active && (
        <FilterSheet title={active.label} options={active.options} value={active.value}
          onSelect={active.onChange} onClose={() => setOpenKey(null)} />
      )}
    </>
  );
}

const fmt = (v: any, d = 2) => v != null ? parseFloat(v).toFixed(d) : '--';
const fmtDate = (v: any) => v ? new Date(v).toLocaleString('en-GB', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
}).replace(',', '') : '--';

export default function FuturesHistory() {
  const navigate = useNavigate();
  const [active, setActive] = useState('orders');
  const [loading, setLoading] = useState(false);

  const [orders, setOrders]       = useState<any[]>([]);
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [trades, setTrades]       = useState<any[]>([]);
  const [txs, setTxs]             = useState<any[]>([]);
  const [funding, setFunding]     = useState<any[]>([]);

  // Filters
  const [symbol, setSymbol]       = useState('All');
  const [orderType, setOrderType] = useState('All');
  const [direction, setDirection] = useState('All');
  const [status, setStatus]       = useState('All');
  const [posMode, setPosMode]     = useState('All');
  const [posStatus, setPosStatus] = useState('All');
  const [dateRange, setDateRange] = useState('Last 30 days');

  const buildParams = () => {
    const p: any = { limit: 50 };
    if (symbol !== 'All') p.symbol = symbol;
    return p;
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      if (active === 'open') {
        const res = await futuresAPI.getOpenOrders(symbol !== 'All' ? symbol : undefined);
        setOpenOrders((res as any)?.data || res || []);
      } else if (active === 'orders') {
        const res = await futuresAPI.getOrderHistory(symbol !== 'All' ? symbol : undefined, 50);
        setOrders((res as any)?.data || res || []);
      } else if (active === 'positions') {
        const params = buildParams();
        if (posStatus !== 'All') params.status = posStatus.toLowerCase();
        const res = await futuresAPI.getPositionHistory(params);
        setPositions((res as any)?.data || res || []);
      } else if (active === 'trades') {
        const res = await futuresAPI.getTrades(symbol !== 'All' ? symbol : undefined);
        setTrades((res as any)?.data || res || []);
      } else if (active === 'tx') {
        const res = await futuresAPI.getTransactions(buildParams());
        setTxs((res as any)?.data || res || []);
      } else if (active === 'funding') {
        const res = await futuresAPI.getFundingFeeHistory(buildParams());
        setFunding((res as any)?.data || res || []);
      }
    } catch(e) {}
    setLoading(false);
  }, [active, symbol, posStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredOrders = orders.filter(o => {
    if (orderType !== 'All' && !o.order_type?.toLowerCase().includes(orderType.toLowerCase().replace(' ', '_'))) return false;
    if (direction !== 'All' && o.side?.toLowerCase() !== direction.toLowerCase()) return false;
    if (status !== 'All' && o.status?.toLowerCase() !== status.toLowerCase()) return false;
    return true;
  });

  const filteredPositions = positions.filter(p => {
    if (posMode !== 'All' && p.side?.toLowerCase() !== posMode.toLowerCase()) return false;
    return true;
  });

  const typeLabel = (t: string) => t === 'market' ? 'Market' : t === 'limit' ? 'Limit'
    : t === 'stop_market' ? 'Market (Triggered)' : t === 'take_profit_market' ? 'Take Profit Market' : t;

  const statusColor = (s: string) => s === 'filled' ? 'var(--color-success)'
    : s === 'cancelled' ? 'var(--color-danger)' : 'var(--color-muted)';

  const card = (children: React.ReactNode, key: any, onClick?: () => void) => (
    <div key={key} onClick={onClick}
      style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)',
               cursor: onClick ? 'pointer' : 'default' }}>
      {children}
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
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>My Trades</div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>USDⓢ-M Futures</div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <Download size={20} color="var(--color-muted)" />
          <MoreHorizontal size={20} color="var(--color-muted)" />
        </div>
      </div>

      {/* Top Tabs */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--color-border)' }}>
        {TOP_TABS.map(t => (
          <button key={t.key} onClick={() => setActive(t.key)}
            style={{ padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
                     fontSize: 13, fontWeight: active === t.key ? 700 : 400, whiteSpace: 'nowrap',
                     color: active === t.key ? 'var(--color-text)' : 'var(--color-muted)',
                     borderBottom: active === t.key ? '2px solid var(--color-primary)' : '2px solid transparent' }}>
            {t.key === 'open' ? `${t.label} (${openOrders.length})` : t.label}
          </button>
        ))}
      </div>

      {/* Filters per tab */}
      {(active === 'orders') && (
        <FilterBar filters={[
          { key: 'symbol', label: 'Symbol', value: symbol, options: SYMBOL_OPTS, onChange: setSymbol },
          { key: 'type', label: 'Order Type', value: orderType, options: TYPE_OPTS, onChange: setOrderType },
          { key: 'dir', label: 'Direction', value: direction, options: DIRECTION_OPTS, onChange: setDirection },
          { key: 'status', label: 'Status', value: status, options: STATUS_OPTS, onChange: setStatus },
        ]} />
      )}
      {active === 'positions' && (
        <FilterBar filters={[
          { key: 'symbol', label: 'Symbol', value: symbol, options: SYMBOL_OPTS, onChange: setSymbol },
          { key: 'mode', label: 'Mode', value: posMode, options: POS_MODE_OPTS, onChange: setPosMode },
          { key: 'pstatus', label: 'Status', value: posStatus, options: POS_STATUS_OPTS, onChange: setPosStatus },
        ]} />
      )}
      {(active === 'trades' || active === 'open') && (
        <FilterBar filters={[
          { key: 'symbol', label: 'Symbol', value: symbol, options: SYMBOL_OPTS, onChange: setSymbol },
        ]} />
      )}
      {(active === 'tx' || active === 'funding') && (
        <FilterBar filters={[
          { key: 'symbol', label: 'Asset', value: symbol, options: ['All','USDT'], onChange: setSymbol },
        ]} />
      )}

      {active === 'positions' && (
        <div style={{ padding: '0 16px 4px', fontSize: 11, color: 'var(--color-muted)' }}>
          Last updated: {new Date().toLocaleString('en-GB')}
          <div style={{ marginTop: 4 }}>* Due to data complexity, there may be some delay. Please scroll down to refresh and update the data.</div>
        </div>
      )}

      {/* Content */}
      <div style={{ paddingBottom: 60 }}>
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--color-muted)', fontSize: 12 }}>Loading...</div>}

        {!loading && active === 'open' && (
          openOrders.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>No open orders</div>
            : openOrders.map((o: any) => card(<>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{o.symbol} <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.08)', color: 'var(--color-muted)' }}>Perp</span></span>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fmtDate(o.created_at)}</span>
                </div>
                <div style={{ fontSize: 13, marginBottom: 6, color: o.side==='buy'?'var(--color-success)':'var(--color-danger)' }}>
                  {typeLabel(o.order_type)} / {o.side==='buy'?'Buy':'Sell'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Qty / Price</span>
                  <span>{fmt(o.quantity,4)} / {o.price ? fmt(o.price) : 'Market'}</span>
                </div>
              </>, o.id))
        )}

        {!loading && active === 'orders' && (
          filteredOrders.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>No orders</div>
            : filteredOrders.map((o: any) => card(<>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                    {o.symbol} <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.08)', color: 'var(--color-muted)' }}>Perp</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-muted)' }}>
                    {fmtDate(o.created_at)} <ChevronRight size={14} />
                  </span>
                </div>
                <div style={{ fontSize: 13, marginBottom: 8, color: o.side==='buy'?'var(--color-success)':'var(--color-danger)' }}>
                  {typeLabel(o.order_type)} / {o.side==='buy'?'Buy':'Sell'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Amount (USDT)</span>
                  <span>{fmt((parseFloat(o.filled_qty||0)*parseFloat(o.avg_fill_price||0)),2)}/{fmt((parseFloat(o.quantity||0)*parseFloat(o.avg_fill_price||o.price||0)),1)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Price</span>
                  <span>{o.avg_fill_price ? fmt(o.avg_fill_price) : fmt(o.price)}/{o.order_type==='market'?'Market':'Limit'}</span>
                </div>
                {o.reduce_only && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-muted)' }}>Reduce Only</span><span>True</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Status</span>
                  <span style={{ color: statusColor(o.status), fontWeight: 600 }}>
                    {o.status?.charAt(0).toUpperCase()+o.status?.slice(1)}
                  </span>
                </div>
              </>, o.id, () => navigate(`/futures-order/${o.id}`)))
        )}

        {!loading && active === 'positions' && (
          filteredPositions.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>No position history</div>
            : filteredPositions.map((p: any) => {
              const pnl = parseFloat(p.realized_pnl||0);
              const margin = parseFloat(p.margin||0);
              const roi = margin > 0 ? (pnl/margin)*100 : 0;
              const isLong = p.side === 'long';
              return card(<>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width:18,height:18,borderRadius:4,background: isLong?'var(--color-success)':'var(--color-danger)',
                                   color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center' }}>
                      {isLong?'B':'S'}
                    </span>
                    <span style={{ fontWeight: 700 }}>{p.symbol}</span>
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.08)', color: 'var(--color-muted)' }}>Perp</span>
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.08)', color: 'var(--color-muted)' }}>
                      Isolated {p.leverage}x
                    </span>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: p.status==='liquidated'?'var(--color-danger)':'var(--color-muted)' }}>
                    {p.status?.charAt(0).toUpperCase()+p.status?.slice(1)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Realized PNL (USDT)</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: pnl>=0?'var(--color-success)':'var(--color-danger)' }}>
                      {pnl>=0?'+':''}{fmt(pnl,2)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>ROI</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: roi>=0?'var(--color-success)':'var(--color-danger)' }}>
                      {roi>=0?'+':''}{fmt(roi,2)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Closed Vol.</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(p.quantity,4)}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 12, marginBottom: 8 }}>
                  <div><div style={{ color: 'var(--color-muted)' }}>Entry Price</div><div>{fmt(p.entry_price)}</div></div>
                  <div><div style={{ color: 'var(--color-muted)' }}>Avg. Close Price</div><div>{fmt(p.mark_price)}</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ color: 'var(--color-muted)' }}>Max OI</div><div>{fmt(p.quantity,4)}</div></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Opened</span><span>{fmtDate(p.opened_at)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Closed</span><span>{fmtDate(p.closed_at)}</span>
                </div>
              </>, p.id);
            })
        )}

        {!loading && active === 'trades' && (
          trades.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>No trades</div>
            : trades.map((t: any) => card(<>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{t.symbol}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fmtDate(t.created_at)}</span>
                </div>
                <div style={{ fontSize: 13, marginBottom: 4, color: t.side==='buy'?'var(--color-success)':'var(--color-danger)' }}>
                  {t.side==='buy'?'Buy':'Sell'} · {t.is_maker?'Maker':'Taker'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Qty @ Price</span>
                  <span>{fmt(t.quantity,4)} @ {fmt(t.price)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Fee</span><span>{fmt(t.fee,6)}</span>
                </div>
              </>, t.id))
        )}

        {!loading && active === 'tx' && (
          txs.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>No transactions</div>
            : txs.map((tx: any) => {
              const amt = parseFloat(tx.amount||0);
              const typeLbl = tx.type === 'futures_fee' ? 'Commission'
                : tx.type === 'futures_pnl' ? 'Realized PNL'
                : tx.type === 'futures_funding' ? 'Funding Fee'
                : tx.type === 'futures_liquidation' ? 'Liquidation' : tx.type;
              return card(<>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700 }}>{tx.coin_symbol}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fmtDate(tx.created_at)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Type</span><span>{typeLbl}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Symbol</span>
                  <span>{tx.description?.match(/[A-Z]{3,}USDT/)?.[0] || ''} Perpetual</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Amount</span>
                  <span style={{ color: amt>=0?'var(--color-success)':'var(--color-danger)', fontWeight: 600 }}>
                    {amt>=0?'+':''}{fmt(amt,8)}
                  </span>
                </div>
              </>, tx.id);
            })
        )}

        {!loading && active === 'funding' && (
          funding.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>No more data</div>
            : funding.map((f: any) => {
              const amt = parseFloat(f.amount||0);
              return card(<>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700 }}>{f.coin_symbol}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fmtDate(f.created_at)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Symbol</span>
                  <span>{f.description?.match(/[A-Z]{3,}USDT/)?.[0] || ''} Perpetual</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Amount</span>
                  <span style={{ color: amt>=0?'var(--color-success)':'var(--color-danger)', fontWeight: 600 }}>
                    {amt>=0?'+':''}{fmt(amt,8)}
                  </span>
                </div>
              </>, f.id);
            })
        )}
      </div>
    </div>
  );
}
