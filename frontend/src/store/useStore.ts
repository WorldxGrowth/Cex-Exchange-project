import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  uid: string; email: string; phone?: string;
  kyc_level: number; vip_level: number;
  theme: string; language: string;
  referral_code: string; two_fa_enabled: boolean;
}

interface StoreState {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  setUser: (user: User, token: string) => void;
  logout: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  selectedPair: string;
  setSelectedPair: (pair: string) => void;
  prices: Record<string, any>;
  setPrice: (symbol: string, data: any) => void;
  // CACHE
  pairs: any[];
  setPairs: (pairs: any[]) => void;
  pairsLoadedAt: number;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      user: null, token: null, isLoggedIn: false,
      setUser: (user, token) => set({ user, token, isLoggedIn: true }),
      logout: () => set({ user: null, token: null, isLoggedIn: false }),
      theme: 'dark',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      selectedPair: 'BTCUSDT',
      setSelectedPair: (pair) => set({ selectedPair: pair }),
      prices: {},
      setPrice: (symbol, data) => set((s) => ({ prices: { ...s.prices, [symbol]: data } })),
      // Cache - pairs 60 sec tak valid
      pairs: [],
      setPairs: (pairs) => set({ pairs, pairsLoadedAt: Date.now() }),
      pairsLoadedAt: 0,
    }),
    {
      name: 'vdexchange-store',
      partialize: (s) => ({
        token: s.token, user: s.user, theme: s.theme,
        pairs: s.pairs, pairsLoadedAt: s.pairsLoadedAt  // Cache persist
      })
    }
  )
);
