import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, X, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ShareCardModal from './ShareCardModal';
import { futuresAPI } from '../../services/api';

interface Props {
  symbol?: string;
  refresh?: number;
  onRefresh?: () => void;
}

const TABS = [
  { key: 'positions', label: 'Positions' },
  { key: 'orders',    label: 'Orders'    },
  { key: 'history',   label: 'History'   },
];

export default function FuturesPositions({ symbol, refresh = 0, onRefresh }: Props) {
  const navigate = useNavigate();
  const [active, setActive]           = useState('positions');
  const [showCurrent, setShowCurrent] = useState(false);
  const [positions, setPositions]     = useState<any[]>([]);
  const [openOrders, setOpenOrders]   = useState<any[]>([]);
  const [history, setHistory]         = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [closingId, setClosingId]     = useState<number|null>(null);
  const [cancellingId, setCancellingId] = useState<number|null>(null);
  const [showClose, setShowClose]     = useState<any>(null);
  const [closeQty, setCloseQty]       = useState('');
  const [showTpSl, setShowTpSl]       = useState<any>(null);
  const [tpInput, setTpInput]         = useState('');
  const [slInput, setSlInput]         = useState('');
  const [savingTpSl, setSavingTpSl]   = useState(false);
  const [showOrderEdit, setShowOrderEdit] = useState<any>(null);
  const [editPrice, setEditPrice]     = useState('');
  const [editQty, setEditQty]         = useState('');
  const [editTp, setEditTp]           = useState('');
  const [editSl, setEditSl]           = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const [showShare, setShowShare]     = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [posRes, ordRes] = await Promise.all([
        futuresAPI.getPositions(),
        futuresAPI.getOpenOrders(symbol),
      ]);
      const posData = (posRes as any)?.data || posRes || [];
      const ordData = (ordRes as any)?.data || ordRes || [];
      setPositions(Array.isArray(posData) ? posData : []);
      setOpenOrders(Array.isArray(ordData) ? ordData : []);
    } catch(e) {}
    setLoading(false);
  }, [symbol]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await futuresAPI.getOrderHistory(symbol);
      const data = (res as any)?.data || res || [];
      setHistory(Array.isArray(data) ? data.slice(0,20) : []);
    } catch(e) {}
  }, [symbol]);

  useEffect(() => { fetchData(); }, [fetchData, refresh]);
  useEffect(() => { if (active === 'history') fetchHistory(); }, [active, fetchHistory]);

  // Auto refresh PnL every 1s
  useEffect(() => {
    const t = setInterval(fetchData, 1000);
    return () => clearInterval(t);
  }, [fetchData]);

  const filteredPositions = showCurrent && symbol
    ? positions.filter(p => p.symbol === symbol)
    : positions;

  const filteredOrders = showCurrent && symbol
    ? openOrders.filter(o => o.symbol === symbol)
    : openOrders;

  const handleClose = async (pos: any, qty?: string) => {
    setClosingId(pos.id);
    try {
      const body = qty ? { close_qty: parseFloat(qty) } : {};
      await futuresAPI.closePosition(parseInt(pos.id), body);
      setShowClose(null);
      setCloseQty('');
      await fetchData();
      onRefresh?.();
    } catch(e: any) {
      alert(e?.message || 'Close failed');
    } finally {
      setClosingId(null);
    }
  };

  const handleCancel = async (orderId: number) => {
    setCancellingId(orderId);
    try {
      await futuresAPI.cancelOrder(orderId);
      await fetchData();
    } catch(e: any) {
      alert(e?.message || 'Cancel failed');
    } finally {
      setCancellingId(null);
    }
  };

  const handleTpSl = async () => {
    if (!showTpSl) return;
    setSavingTpSl(true);
    try {
      await futuresAPI.updateTpSl(parseInt(showTpSl.id), {
        take_profit: tpInput || null,
        stop_loss:   slInput || null,
      });
      setShowTpSl(null); setTpInput(''); setSlInput('');
      await fetchData();
    } catch(e: any) { alert(e?.message || 'Failed to update TP/SL'); }
    finally { setSavingTpSl(false); }
  };

  const handleModifyOrder = async () => {
    if (!showOrderEdit) return;
    setSavingOrder(true);
    try {
      await futuresAPI.modifyOrder(parseInt(showOrderEdit.id), {
        price: editPrice || undefined,
        quantity: editQty || undefined,
        take_profit: editTp || null,
        stop_loss: editSl || null,
      });
      setShowOrderEdit(null);
      await fetchData();
    } catch(e: any) { alert(e?.message || 'Failed to modify order'); }
    finally { setSavingOrder(false); }
  };

  const pnlColor = (pnl: number) =>
    pnl > 0 ? 'var(--color-success)' : pnl < 0 ? 'var(--color-danger)' : 'var(--color-muted)';

  const statusColor = (s: string) =>
    s === 'filled' ? 'var(--color-success)'
    : s === 'cancelled' ? 'var(--color-danger)'
    : 'var(--color-muted)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%',
                  borderTop: '1px solid var(--color-border)' }}>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0,
                    background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(({ key, label }) => {
          const count = key === 'positions' ? filteredPositions.length
                      : key === 'orders'    ? filteredOrders.length : null;
          return (
            <button key={key} onClick={() => setActive(key)} style={{
              padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: active === key ? 600 : 400,
              color: active === key ? 'var(--color-text)' : 'var(--color-muted)',
              borderBottom: active === key ? '2px solid var(--color-primary)' : '2px solid transparent',
              whiteSpace: 'nowrap'
            }}>
              {label}{count !== null ? ` (${count})` : ''}
            </button>
          );
        })}
        <button style={{ marginLeft: 'auto', padding: '8px 10px', background: 'none',
                         border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
          onClick={() => navigate('/futures-history')}>
          <ClipboardList size={16} />
        </button>
      </div>

      {/* Filter row */}
      {(active === 'positions' || active === 'orders') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 12px', flexShrink: 0,
                      borderBottom: '1px solid var(--color-border)',
                      background: 'var(--color-bg)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 11, color: 'var(--color-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showCurrent}
              onChange={e => setShowCurrent(e.target.checked)}
              style={{ accentColor: 'var(--color-primary)' }} />
            Show current
          </label>
          {active === 'positions' && positions.length > 0 && (
            <button onClick={() => positions.forEach(p => handleClose(p))}
              style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6,
                       fontSize: 11, fontWeight: 600,
                       border: '1px solid var(--color-border)',
                       background: 'var(--color-surface2)',
                       color: 'var(--color-danger)', cursor: 'pointer' }}>
              Close all
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>

        {/* POSITIONS */}
        {active === 'positions' && (
          loading && positions.length === 0
          ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-muted)', fontSize: 12 }}>Loading...</div>
          : filteredPositions.length === 0
          ? <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          color: 'var(--color-muted)', fontSize: 12, padding: 20 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📋</div>
              <div>No open positions</div>
            </div>
          : <div>
              {filteredPositions.map((pos: any) => {
                const pnl     = parseFloat(pos.unrealizedPnl || pos.unrealized_pnl || 0);
                const roe     = parseFloat(pos.roe || 0);
                const entry   = parseFloat(pos.entryPrice || pos.entry_price || 0);
                const mark    = parseFloat(pos.markPrice  || pos.mark_price  || 0);
                const liq     = parseFloat(pos.liquidationPrice || pos.liquidation_price || 0);
                const margin  = parseFloat(pos.margin || 0);
                const qty     = parseFloat(pos.quantity || 0);
                const isLong  = pos.side === 'long';
                return (
                  <div key={pos.id} style={{ padding: '10px 12px',
                                              borderBottom: '1px solid var(--color-border)' }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{pos.symbol}</span>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                       background: isLong ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)',
                                       color: isLong ? 'var(--color-success)' : 'var(--color-danger)',
                                       fontWeight: 600 }}>
                          {isLong ? 'Long' : 'Short'} {pos.leverage}x
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>
                          {pos.marginType || pos.margin_type}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setShowShare({
                          symbol: pos.symbol, side: pos.side, leverage: pos.leverage,
                          pnl, roi: roe, entryPrice: entry, markPrice: mark,
                        })} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11,
                                 border: '1px solid var(--color-border)',
                                 background: 'var(--color-surface2)',
                                 color: 'var(--color-text)', cursor: 'pointer' }}>
                          📤
                        </button>
                        <button onClick={() => { setShowClose(pos); setCloseQty(qty.toString()); }}
                          style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                 border: '1px solid var(--color-border)',
                                 background: 'var(--color-surface2)',
                                 color: 'var(--color-text)', cursor: 'pointer' }}>
                          Close
                        </button>
                      </div>
                    </div>
                    {/* PnL row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--color-muted)' }}>PnL (USDT)</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: pnlColor(pnl) }}>
                          {pnl >= 0 ? '+' : ''}{pnl.toFixed(4)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'var(--color-muted)' }}>ROI</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: pnlColor(roe) }}>
                          {roe >= 0 ? '+' : ''}{roe.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    {/* Details grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                                  gap: '4px 8px', fontSize: 10 }}>
                      {[
                        ['Size', `${qty} ${pos.symbol?.replace('USDT','')||''}`],
                        ['Margin', `${margin.toFixed(4)}`],
                        ['Entry', entry.toFixed(2)],
                        ['Mark',  mark.toFixed(2)],
                        ['Liq.',  liq.toFixed(2)],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <div style={{ color: 'var(--color-muted)' }}>{label}</div>
                          <div style={{ color: 'var(--color-text)', fontWeight: 500 }}>{val}</div>
                        </div>
                      ))}
                      {/* TP/SL with pencil edit icon */}
                      <div>
                        <div style={{ color: 'var(--color-muted)' }}>TP/SL</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => {
                            setShowTpSl(pos);
                            setTpInput(String(pos.takeProfit || pos.take_profit || ''));
                            setSlInput(String(pos.stopLoss  || pos.stop_loss  || ''));
                          }}>
                          <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
                            {(pos.takeProfit||pos.take_profit)
                              ? `${parseFloat(pos.takeProfit||pos.take_profit||0).toFixed(2)} / ${parseFloat(pos.stopLoss||pos.stop_loss||0).toFixed(2)}`
                              : '--'}
                          </span>
                          <span style={{ cursor: 'pointer', color: 'var(--color-primary)',
                                         fontSize: 11, lineHeight: 1 }}>✏️</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
        )}

        {/* OPEN ORDERS */}
        {active === 'orders' && (
          filteredOrders.length === 0
          ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-muted)', fontSize: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📋</div>
              <div>No open orders</div>
            </div>
          : <div>
              {filteredOrders.map((ord: any) => (
                <div key={ord.id} style={{ padding: '8px 12px',
                                           borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{ord.symbol}</span>
                      <span style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4,
                                     background: ord.side === 'buy' ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)',
                                     color: ord.side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {ord.side?.toUpperCase()} {ord.order_type?.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => {
                        setShowOrderEdit(ord);
                        setEditPrice(String(ord.price || ''));
                        setEditQty(String(ord.quantity || ''));
                        setEditTp(String(ord.take_profit || ''));
                        setEditSl(String(ord.stop_loss || ''));
                      }} style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10,
                               border: '1px solid var(--color-border)',
                               background: 'transparent', color: 'var(--color-primary)',
                               cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        ✏️
                      </button>
                      <button onClick={() => handleCancel(parseInt(ord.id))}
                        disabled={cancellingId === parseInt(ord.id)}
                        style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10,
                                 border: '1px solid var(--color-danger)',
                                 background: 'transparent', color: 'var(--color-danger)',
                                 cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <X size={10} />
                        {cancellingId === parseInt(ord.id) ? '...' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                                gap: '3px 8px', fontSize: 10 }}>
                    {[
                      ['Qty',    parseFloat(ord.quantity||0).toFixed(4)],
                      ['Price',  ord.price ? parseFloat(ord.price).toFixed(2) : 'Market'],
                      ['Margin', parseFloat(ord.margin_used||0).toFixed(4)],
                      ['Lev.',   `${ord.leverage}x`],
                      ['TP',     ord.take_profit ? parseFloat(ord.take_profit).toFixed(2) : '--'],
                      ['SL',     ord.stop_loss   ? parseFloat(ord.stop_loss).toFixed(2)   : '--'],
                    ].map(([l,v]) => (
                      <div key={l}>
                        <div style={{ color: 'var(--color-muted)' }}>{l}</div>
                        <div style={{ color: 'var(--color-text)' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
        )}

        {/* HISTORY */}
        {active === 'history' && (
          history.length === 0
          ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-muted)', fontSize: 12 }}>
              No history
            </div>
          : <div>
              {history.map((ord: any) => (
                <div key={ord.id} style={{ padding: '6px 12px',
                                           borderBottom: '1px solid var(--color-border)',
                                           display: 'flex', justifyContent: 'space-between',
                                           alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{ord.symbol}</span>
                      <span style={{ fontSize: 10,
                                     color: ord.side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {ord.side?.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-muted)' }}>
                      {ord.order_type} · {parseFloat(ord.quantity||0).toFixed(4)}
                      {ord.avg_fill_price ? ` @ ${parseFloat(ord.avg_fill_price).toFixed(2)}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, fontWeight: 600,
                                  color: statusColor(ord.status) }}>
                      {ord.status?.toUpperCase()}
                    </div>
                    {ord.fee && (
                      <div style={{ fontSize: 10, color: 'var(--color-muted)' }}>
                        Fee: {parseFloat(ord.fee).toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
        )}
      </div>

      {/* TP/SL Modal */}
      {showTpSl && (() => {
        const _entry  = parseFloat(showTpSl.entryPrice||showTpSl.entry_price||0);
        const _qty    = parseFloat(showTpSl.quantity||0);
        const _lev    = parseFloat(showTpSl.leverage||1);
        const _margin = parseFloat(showTpSl.margin||0);
        const _isLong = showTpSl.side === 'long';
        const calcPnl = (price: string) => {
          if (!price || !_entry) return null;
          const p = parseFloat(price);
          const pnl = _isLong ? (p - _entry) * _qty : (_entry - p) * _qty;
          const roi = _margin > 0 ? (pnl / _margin) * 100 : 0;
          return { pnl, roi };
        };
        const tpCalc = calcPnl(tpInput);
        const slCalc = calcPnl(slInput);
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                        zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowTpSl(null)}>
            <div style={{ background: 'var(--color-surface)', borderRadius: 16,
                          padding: '24px', width: '90%', maxWidth: 420,
                          border: '1px solid var(--color-border)',
                          boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                Set TP/SL — {showTpSl.symbol} <span style={{
                  color: _isLong ? 'var(--color-success)' : 'var(--color-danger)'
                }}>{showTpSl.side}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 20 }}>
                Entry: <span style={{ color: 'var(--color-text)' }}>{_entry.toFixed(4)}</span> &nbsp;|&nbsp;
                Qty: <span style={{ color: 'var(--color-text)' }}>{_qty}</span> &nbsp;|&nbsp;
                {_lev}x
              </div>

              {/* Take Profit */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-success)' }}>
                    ✅ Take Profit
                  </span>
                  {tpCalc && (
                    <span style={{ fontSize: 11, fontWeight: 600,
                                   color: tpCalc.pnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {tpCalc.pnl >= 0 ? '+' : ''}{tpCalc.pnl.toFixed(4)} USDT &nbsp;
                      ({tpCalc.roi >= 0 ? '+' : ''}{tpCalc.roi.toFixed(2)}%)
                    </span>
                  )}
                </div>
                <input value={tpInput} onChange={e => setTpInput(e.target.value)}
                  type="number" placeholder="TP Price (USDT)"
                  style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13,
                           border: '1px solid rgba(14,203,129,0.4)', background: 'var(--color-surface2)',
                           color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' as any }} />
              </div>

              {/* Stop Loss */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-danger)' }}>
                    🛑 Stop Loss
                  </span>
                  {slCalc && (
                    <span style={{ fontSize: 11, fontWeight: 600,
                                   color: slCalc.pnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {slCalc.pnl >= 0 ? '+' : ''}{slCalc.pnl.toFixed(4)} USDT &nbsp;
                      ({slCalc.roi >= 0 ? '+' : ''}{slCalc.roi.toFixed(2)}%)
                    </span>
                  )}
                </div>
                <input value={slInput} onChange={e => setSlInput(e.target.value)}
                  type="number" placeholder="SL Price (USDT)"
                  style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13,
                           border: '1px solid rgba(246,70,93,0.4)', background: 'var(--color-surface2)',
                           color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' as any }} />
              </div>

              <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 20,
                            padding: '8px 12px', borderRadius: 8, background: 'var(--color-bg)' }}>
                Mark: <span style={{ color: 'var(--color-text)' }}>
                  {parseFloat(showTpSl.markPrice||showTpSl.mark_price||0).toFixed(4)} USDT
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setShowTpSl(null); setTpInput(''); setSlInput(''); }}
                  style={{ flex: 1, padding: '12px', borderRadius: 10,
                           border: '1px solid var(--color-border)',
                           background: 'transparent', color: 'var(--color-text)',
                           fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleTpSl} disabled={savingTpSl}
                  style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                           background: savingTpSl ? 'rgba(240,185,11,0.4)' : 'var(--color-primary)',
                           color: '#000', fontSize: 14, fontWeight: 700,
                           cursor: savingTpSl ? 'not-allowed' : 'pointer',
                           opacity: savingTpSl ? 0.7 : 1 }}>
                  {savingTpSl ? '⏳ Saving...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Share PnL Card Modal */}
      {showShare && (
        <ShareCardModal data={showShare} onClose={() => setShowShare(null)} />
      )}

      {/* Order Modify Modal (price, qty, TP/SL for pending limit orders) */}
      {showOrderEdit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                      zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowOrderEdit(null)}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 16,
                        padding: '24px', width: '90%', maxWidth: 420,
                        border: '1px solid var(--color-border)',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              Modify Order — {showOrderEdit.symbol} <span style={{
                color: showOrderEdit.side === 'buy' ? 'var(--color-success)' : 'var(--color-danger)'
              }}>{showOrderEdit.side?.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 20 }}>
              Limit Order &nbsp;|&nbsp; Leverage: {showOrderEdit.leverage}x
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>Price (USDT)</div>
              <input value={editPrice} onChange={e => setEditPrice(e.target.value)}
                type="number" placeholder="Price"
                style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13,
                         border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
                         color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' as any }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>Quantity</div>
              <input value={editQty} onChange={e => setEditQty(e.target.value)}
                type="number" placeholder="Quantity"
                style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13,
                         border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
                         color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' as any }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-success)', marginBottom: 6 }}>✅ Take Profit</div>
              <input value={editTp} onChange={e => setEditTp(e.target.value)}
                type="number" placeholder="TP Price (optional)"
                style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13,
                         border: '1px solid rgba(14,203,129,0.4)', background: 'var(--color-surface2)',
                         color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' as any }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-danger)', marginBottom: 6 }}>🛑 Stop Loss</div>
              <input value={editSl} onChange={e => setEditSl(e.target.value)}
                type="number" placeholder="SL Price (optional)"
                style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13,
                         border: '1px solid rgba(246,70,93,0.4)', background: 'var(--color-surface2)',
                         color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' as any }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowOrderEdit(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 10,
                         border: '1px solid var(--color-border)',
                         background: 'transparent', color: 'var(--color-text)',
                         fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleModifyOrder} disabled={savingOrder}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                         background: savingOrder ? 'rgba(240,185,11,0.4)' : 'var(--color-primary)',
                         color: '#000', fontSize: 14, fontWeight: 700,
                         cursor: savingOrder ? 'not-allowed' : 'pointer',
                         opacity: savingOrder ? 0.7 : 1 }}>
                {savingOrder ? '⏳ Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close position modal */}
      {showClose && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                      zIndex: 300, display: 'flex', alignItems: 'flex-end',
                      justifyContent: 'center' }}
          onClick={() => setShowClose(null)}>
          <div style={{ background: 'var(--color-surface)', borderRadius: '16px 16px 0 0',
                        padding: '20px', width: '100%', maxWidth: 480 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
              Close {showClose.symbol} {showClose.side}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8 }}>
              Position: {parseFloat(showClose.quantity||0).toFixed(4)} | Margin: {parseFloat(showClose.margin||0).toFixed(4)} USDT
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 4 }}>Close Quantity</div>
              <input value={closeQty} onChange={e => setCloseQty(e.target.value)}
                type="number" max={showClose.quantity} step="0.001"
                style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13,
                         border: '1px solid var(--color-border)',
                         background: 'var(--color-surface2)', color: 'var(--color-text)',
                         outline: 'none', boxSizing: 'border-box' as any }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                {[25,50,75,100].map(p => (
                  <button key={p} onClick={() => setCloseQty((parseFloat(showClose.quantity||0) * p / 100).toFixed(4))}
                    style={{ flex: 1, padding: '6px', borderRadius: 6, fontSize: 11,
                             border: '1px solid var(--color-border)',
                             background: 'var(--color-surface2)', color: 'var(--color-text)',
                             cursor: 'pointer' }}>{p}%</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowClose(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 10,
                         border: '1px solid var(--color-border)',
                         background: 'transparent', color: 'var(--color-text)',
                         fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleClose(showClose, closeQty)}
                disabled={closingId === parseInt(showClose.id)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                         background: showClose.side === 'long' ? 'var(--color-danger)' : 'var(--color-success)',
                         color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {closingId === parseInt(showClose.id) ? 'Closing...' : 'Confirm Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
