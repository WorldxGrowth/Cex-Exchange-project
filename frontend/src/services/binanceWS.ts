// Binance WebSocket - Real Order Book
let ws: WebSocket | null = null;
let currentSymbol = '';
let callback: ((data: any) => void) | null = null;

export const subscribeBinanceOrderBook = (symbol: string, onData: (data: any) => void) => {
  // Close existing
  if (ws) { ws.close(); ws = null; }

  currentSymbol = symbol.toLowerCase();
  callback = onData;

  const connect = () => {
    try {
      ws = new WebSocket(
        `wss://stream.binance.com:9443/ws/${currentSymbol}@depth20@100ms`
      );

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (callback) callback({
            bids: data.bids?.slice(0, 15) || [],
            asks: data.asks?.slice(0, 15) || []
          });
        } catch {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        // Reconnect after 3s
        setTimeout(() => {
          if (currentSymbol) connect();
        }, 3000);
      };
    } catch {}
  };

  connect();
};

export const unsubscribeBinanceOrderBook = () => {
  if (ws) { ws.close(); ws = null; }
  currentSymbol = '';
  callback = null;
};
