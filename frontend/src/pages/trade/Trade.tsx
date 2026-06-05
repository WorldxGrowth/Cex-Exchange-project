import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { marketAPI, orderAPI, walletAPI } from '../../services/api';
import { subscribeToTicker, subscribeToOrderBook, getSocket } from '../../services/socket';
import { subscribeBinanceOrderBook, unsubscribeBinanceOrderBook } from '../../services/binanceWS';
import toast from 'react-hot-toast';

import TradeHeader from '../../components/trade/TradeHeader';
import OrderBook, { RecentTrades } from '../../components/trade/OrderBook';
import OrderForm from '../../components/trade/OrderForm';
import OpenOrders from '../../components/trade/OpenOrders';

export default function Trade() {
  const { symbol = 'BTCUSDT' } = useParams();
  const { prices } = useStore();

  const [ticker, setTicker]             = useState<any>(null);
  const [orderBook, setOrderBook]       = useState<any>({ bids: [], asks: [] });
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [balances, setBalances]         = useState<any>({});
  const [openOrders, setOpenOrders]     = useState<any[]>([]);
  const [showTrades, setShowTrades]     = useState(false);
  const [bottomTab, setBottomTab]       = useState<'orders'|'assets'>('orders');
  const [side, setSide]                 = useState<'buy'|'sell'>('buy');
  const [orderType, setOrderType]       = useState<'limit'|'market'>('limit');
  const [price, setPrice]               = useState('');
  const [quantity, setQuantity]         = useState('');
  const [totalInput, setTotalInput]     = useState('');
  const [pct, setPct]                   = useState(0);
  const [loading, setLoading]           = useState(false);
  const [pairInfo, setPairInfo]         = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTopTab, setActiveTopTab] = useState<'spot'|'earn'>('spot');
  const obRef = useRef<any>({ bids: [], asks: [] });

  const sym          = symbol.toUpperCase();
  const liveData     = prices[sym];
  const currentPrice = parseFloat(liveData?.price || ticker?.price || '0');
  const change24h    = parseFloat(liveData?.change_24h || ticker?.change_24h || '0');
  const isUp         = change24h >= 0;
  const baseSym      = pairInfo?.base_symbol || sym.replace('USDT', '');
  const availBal     = side === 'buy'
    ? parseFloat(balances['USDT']?.available || 0)
    : parseFloat(balances[baseSym]?.available || 0);

  const loadBalances = () => {
    walletAPI.getBalances().then((res: any) => {
      const bal: any = {};
      (res.data?.balances || []).forEach((b: any) => {
        bal[b.symbol + '_' + b.account_type] = b;
        if (b.account_type === 'spot') bal[b.symbol] = b;
      });
      setBalances(bal);
    });
  };

  useEffect(() => {
    marketAPI.getTicker(sym).then((res: any) => {
      setTicker(res.data); setPairInfo(res.data);
      const p = parseFloat(res.data.price || 0);
      if (p > 0) setPrice(p.toFixed(4));
    });
    marketAPI.getOrderBook(sym, 15).then((res: any) => {
      const data = res.data || { bids: [], asks: [] };
      obRef.current = data; setOrderBook(data);
    });
    marketAPI.getTrades(sym).then((res: any) =>
      setRecentTrades((res.data || []).slice(0, 30)));
    loadBalances();
    orderAPI.getOpen(sym).then((res: any) => setOpenOrders(res.data || []));
    subscribeToTicker(sym);
    subscribeToOrderBook(sym);
    subscribeBinanceOrderBook(sym, (data) => {
      obRef.current = data; setOrderBook({ ...data });
    });
    const socket = getSocket();
    socket.on('orderbook', (data: any) => {
      if (data.symbol === sym) { obRef.current = data; setOrderBook({ ...data }); }
    });
    socket.on('order_update', (data: any) => {
      if (data.status === 'filled' || data.status === 'cancelled') {
        setOpenOrders((prev: any[]) => prev.filter((o: any) => o.order_id !== data.order_id));
        if (data.status === 'filled') loadBalances();
      } else if (data.status === 'partially_filled') {
        setOpenOrders((prev: any[]) => prev.map((o: any) =>
          o.order_id === data.order_id ? { ...o, ...data } : o
        ));
      }
    });
    const pollTimer = setInterval(() => {
      orderAPI.getOpen(sym).then((res: any) => setOpenOrders(res.data || []));
    }, 30000);
    return () => {
      socket.off('orderbook'); socket.off('order_update');
      clearInterval(pollTimer); unsubscribeBinanceOrderBook();
    };
  }, [symbol]);

  const handlePct = (p: number) => {
    setPct(p);
    if (p === 0) { setQuantity(''); setTotalInput(''); return; }
    const op = parseFloat(price || String(currentPrice) || '1');
    if (side === 'buy') {
      const totalAmt = availBal * p / 100;
      setTotalInput(totalAmt.toFixed(2));
      if (op > 0) setQuantity((totalAmt / op).toFixed(6));
    } else {
      const qty = availBal * p / 100;
      setQuantity(qty.toFixed(6));
      setTotalInput((qty * op).toFixed(2));
    }
  };

  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    const p = parseFloat(price || String(currentPrice) || '0');
    const q = parseFloat(val || '0');
    if (p > 0 && q > 0) setTotalInput((p * q).toFixed(2));
    else setTotalInput('');
  };

  const handleTotalChange = (val: string) => {
    setTotalInput(val);
    const p = parseFloat(price || String(currentPrice) || '0');
    const t = parseFloat(val || '0');
    if (p > 0 && t > 0) setQuantity((t / p).toFixed(6));
    else setQuantity('');
  };

  const handlePlace = async () => {
    if (!quantity || parseFloat(quantity) <= 0) { toast.error('Enter quantity'); return; }
    if (orderType === 'limit' && (!price || parseFloat(price) <= 0)) {
      toast.error('Enter price'); return;
    }
    setLoading(true);
    try {
      const res: any = await orderAPI.place({
        symbol: sym, side, order_type: orderType,
        price: orderType === 'limit' ? price : undefined, quantity
      });
      const order = res.data;
      if (order?.status === 'filled') {
        toast.success(`✅ ${side.toUpperCase()} filled @ ${parseFloat(order.avg_fill_price||order.price||0).toFixed(4)}`);
      } else if (order?.status === 'open' || order?.status === 'partially_filled') {
        toast.success(`${side.toUpperCase()} order placed!`);
        setOpenOrders((prev: any[]) => [order, ...prev]);
      } else {
        toast.success(`${side.toUpperCase()} order placed!`);
      }
      setQuantity(''); setTotalInput(''); setPct(0);
      loadBalances();
      setTimeout(() => {
        orderAPI.getOpen(sym).then((res: any) => setOpenOrders(res.data || []));
        loadBalances();
      }, 2000);
    } catch (err: any) {
      toast.error(err?.message || 'Order failed');
    } finally { setLoading(false); }
  };

  const handleCancel = async (orderId: string) => {
    try {
      await orderAPI.cancel(orderId);
      toast.success('Cancelled');
      setOpenOrders(prev => prev.filter((o: any) => o.order_id !== orderId));
      loadBalances();
    } catch { toast.error('Failed'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh',
                  overflow: 'hidden', background: 'var(--color-bg)' }}>

      <TradeHeader
        baseSym={baseSym} change24h={change24h} isUp={isUp}
        showTrades={showTrades} activeTopTab={activeTopTab} sym={sym}
        onToggleTrades={() => setShowTrades(!showTrades)}
        onTopTabChange={setActiveTopTab}
      />

      <div style={{ display: 'flex', flexShrink: 0 }}>
        <div style={{ width: '42%', maxHeight: '56vh', overflow: 'auto' }}>
          {showTrades
            ? <RecentTrades trades={recentTrades} />
            : <OrderBook bids={orderBook.bids||[]} asks={orderBook.asks||[]}
                currentPrice={currentPrice} isUp={isUp} showTrades={showTrades}
                trades={recentTrades}
                onPriceClick={(p: string) => setPrice(p)} />
          }
        </div>
        <OrderForm
          side={side} orderType={orderType} price={price} quantity={quantity}
          totalInput={totalInput} pct={pct} loading={loading} availBal={availBal}
          baseSym={baseSym} currentPrice={currentPrice} showDropdown={showDropdown}
          onSideChange={setSide} onOrderTypeChange={(t) => { setOrderType(t); setShowDropdown(false); }}
          onPriceChange={setPrice} onQuantityChange={handleQuantityChange}
          onTotalChange={handleTotalChange} onPctChange={handlePct}
          onPlace={handlePlace} onDropdownToggle={() => setShowDropdown(!showDropdown)}
        />
      </div>

      <OpenOrders
        openOrders={openOrders} bottomTab={bottomTab}
        balances={balances} baseSym={baseSym}
        onTabChange={setBottomTab} onCancel={handleCancel}
      />
    </div>
  );
}
