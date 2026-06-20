import { X, ChevronRight, Check, Search } from 'lucide-react';

// ── Bottom Sheet wrapper (shared by both sheets below) ──
export const BottomSheet = ({ open, onClose, children, height = '55vh' }: any) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999,
                  background: 'rgba(0,0,0,0.65)',
                  display: 'flex', flexDirection: 'column',
                  justifyContent: 'flex-end' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--color-surface)', borderRadius: '20px 20px 0 0',
        height, display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center',
                      padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2,
                        background: 'var(--color-border)' }} />
        </div>
        {children}
      </div>
    </div>
  );
};

// Network visual config (logo/color) - lookup by short_name
// Eligibility/list comes dynamically from backend (coin-networks API)
export const NETWORK_VISUALS: Record<string, { logo: string; color: string }> = {
  BSC:     { logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png', color: '#F3BA2F' },
  ETH:     { logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png', color: '#627EEA' },
  VDCHAIN: { logo: 'https://vdscan.io/logo.png', color: '#f0b90b' },
  TRX:     { logo: 'https://cryptologos.cc/logos/tron-trx-logo.png', color: '#FF060A' },
  BTC:     { logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png', color: '#F7931A' },
  SOL:     { logo: 'https://cryptologos.cc/logos/solana-sol-logo.png', color: '#9945FF' },
};
export const getNetworkVisual = (shortName?: string) =>
  (shortName && NETWORK_VISUALS[shortName]) || { logo: '', color: 'var(--color-primary)' };

// ── Network Sheet - dynamic, per-coin ──
export const NetworkSheet = ({
  open, onClose, networksLoading, coinNetworks, selectedNetwork,
  selectedCoin, onSelectNetwork
}: any) => (
  <BottomSheet open={open} onClose={onClose} height="50vh">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 20px 14px', flexShrink: 0 }}>
      <span style={{ fontWeight: 700, fontSize: 17 }}>Select Network</span>
      <button onClick={onClose} style={{
        background: 'var(--color-surface2)', border: 'none', cursor: 'pointer',
        borderRadius: '50%', width: 30, height: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}><X size={16} color="var(--color-muted)" /></button>
    </div>
    <div style={{ margin: '0 16px 14px', padding: '10px 14px', borderRadius: 10,
                  background: '#f0b90b10', border: '1px solid #f0b90b25',
                  fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5, flexShrink: 0 }}>
      Only withdraw to addresses on the selected network!
    </div>
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px' }}>
      {networksLoading && (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-muted)', fontSize: 13 }}>
          Loading networks...
        </div>
      )}
      {!networksLoading && coinNetworks.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-muted)', fontSize: 13 }}>
          No withdrawal networks available for {selectedCoin?.symbol}
        </div>
      )}
      {!networksLoading && coinNetworks.map((net: any) => {
        const visual = getNetworkVisual(net.network);
        const isSelected = selectedNetwork?.network === net.network;
        return (
          <div key={net.network} onClick={() => onSelectNetwork(net)}
            style={{ display: 'flex', alignItems: 'center', gap: 12,
                     padding: '14px 16px', borderRadius: 14, marginBottom: 10,
                     background: isSelected ? visual.color + '15' : 'var(--color-surface)',
                     border: '1px solid ' + (isSelected ? visual.color : 'var(--color-border)'),
                     cursor: 'pointer' }}>
            <img src={visual.logo} alt={net.network}
              style={{ width: 38, height: 38, borderRadius: '50%' }}
              onError={(e) => { (e.target as any).style.display = 'none'; }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{net.network_name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 2 }}>
                ~{net.min_confirmations} confirmations
              </div>
            </div>
            {isSelected && <Check size={18} color={visual.color} />}
          </div>
        );
      })}
    </div>
  </BottomSheet>
);

// ── Coin Sheet for Transfer ──
export const CoinSheet = ({
  open, onClose, search, onSearchChange, coins, selectedCoin, onSelectCoin
}: any) => (
  <BottomSheet open={open} onClose={onClose} height="75vh">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 20px 12px', flexShrink: 0 }}>
      <span style={{ fontWeight: 700, fontSize: 17 }}>Select Coin</span>
      <button onClick={onClose} style={{
        background: 'var(--color-surface2)', border: 'none', cursor: 'pointer',
        borderRadius: '50%', width: 30, height: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}><X size={16} color="var(--color-muted)" /></button>
    </div>
    <div style={{ padding: '0 16px 10px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--color-surface2)', borderRadius: 12,
                    padding: '10px 14px', border: '1px solid var(--color-border)' }}>
        <Search size={14} color="var(--color-muted)" />
        <input value={search} onChange={e => onSearchChange(e.target.value)}
          placeholder="Search..." autoFocus
          style={{ flex: 1, background: 'none', border: 'none',
                   color: 'var(--color-text)', fontSize: 14, outline: 'none' }} />
      </div>
    </div>
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {coins.map((coin: any) => (
        <div key={coin.symbol}
          onClick={() => onSelectCoin(coin)}
          style={{ display: 'flex', alignItems: 'center', gap: 12,
                   padding: '12px 16px', cursor: 'pointer',
                   borderBottom: '1px solid var(--color-border)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          {coin.logo_url
            ? <img src={coin.logo_url} alt=""
                style={{ width: 36, height: 36, borderRadius: '50%' }} />
            : <div style={{ width: 36, height: 36, borderRadius: '50%',
                            background: 'var(--color-surface2)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, color: 'var(--color-primary)', fontSize: 13 }}>
                {coin.symbol?.charAt(0)}
              </div>
          }
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{coin.symbol}</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{coin.name}</div>
          </div>
          {selectedCoin?.symbol === coin.symbol && (
            <Check size={16} color="var(--color-success)" style={{ marginLeft: 'auto' }} />
          )}
        </div>
      ))}
    </div>
  </BottomSheet>
);
