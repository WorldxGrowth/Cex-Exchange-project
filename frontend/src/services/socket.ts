import { io, Socket } from 'socket.io-client';
import { useStore } from '../store/useStore';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const store = JSON.parse(localStorage.getItem('vdexchange-store') || '{}');
    const token = store?.state?.token;

    socket = io('/', {
      transports: ['websocket'],
      auth: token ? { token } : {},
    });

    socket.on('connect', () => console.log('🔌 WS Connected'));
    socket.on('disconnect', () => console.log('🔌 WS Disconnected'));

    // Global price updates
    socket.on('ticker', (data) => {
      useStore.getState().setPrice(data.symbol, data);
    });
  }
  return socket;
};

export const subscribeToTicker = (symbol: string) => {
  getSocket().emit('subscribe_ticker', symbol);
};

export const unsubscribeFromTicker = (symbol: string) => {
  getSocket().emit('unsubscribe_ticker', symbol);
};

export const subscribeToOrderBook = (symbol: string) => {
  getSocket().emit('subscribe_orderbook', symbol);
};

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};
