import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI, marketAPI } from '../../services/api';
import {
  Copy, ChevronRight, ArrowLeft, Search, Check,
  ArrowDownToLine, CreditCard, Users, X, Share2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

const BottomSheet = ({ open, onClose, children, height = '55vh' }: any) => {
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

// Network visual config (logo + color) - lookup by short_name
// Backend now provides which networks are ENABLED per coin (coin-networks API);
// this lookup only supplies presentation details (logo/color), not eligibility.
const NETWORK_VISUALS: Record<string, { logo: string; color: string; confirmations: number }> = {
  BSC: {
    logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
    color: '#F3BA2F', confirmations: 15
  },
  ETH: {
    logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    color: '#627EEA', confirmations: 20
  },
  VDCHAIN: {
    logo: 'https://vdscan.io/logo.png',
    color: '#f0b90b', confirmations: 10
  },
  TRX: {
    logo: 'https://cryptologos.cc/logos/tron-trx-logo.png',
    color: '#FF060A', confirmations: 20
  },
  BTC: {
    logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
    color: '#F7931A', confirmations: 2
  },
  SOL: {
    logo: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    color: '#9945FF', confirmations: 1
  },
};

const getNetworkVisual = (shortName: string) =>
  NETWORK_VISUALS[shortName] || { logo: '', color: 'var(--color-primary)', confirmations: 3 };

// Highlighted address — first 6 + last 6 in primary color
const HighlightedAddress = ({ address }: { address: string }) => {
  if (!address) return null;
  const start = address.slice(0, 6);
  const mid   = address.slice(6, -6);
  const end   = address.slice(-6);
  return (
    <span style={{ fontFamily: 'monospace', fontSize: 13,
                   wordBreak: 'break-all', lineHeight: 1.7 }}>
      <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{start}</span>
      <span style={{ color: 'var(--color-text)' }}>{mid}</span>
      <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{end}</span>
    </span>
  );
};

export default function Deposit() {
  const navigate = useNavigate();

  const [step, setStep]                     = useState<'coin'|'address'>('coin');
  const [showMethodSheet, setShowMethodSheet] = useState(true);
  const [showNetworkSheet, setShowNetworkSheet] = useState(false);
  const [coins, setCoins]                   = useState<any[]>([]);
  const [selectedCoin, setSelectedCoin]     = useState<any>(null);
  const [depositInfo, setDepositInfo]       = useState<any>(null);
  const [loading, setLoading]               = useState(false);
  const [search, setSearch]                 = useState('');
  const [copied, setCopied]                 = useState(false);

  // Dynamic networks for the currently selected coin (from coin_networks table)
  const [coinNetworks, setCoinNetworks]     = useState<any[]>([]);
  const [networksLoading, setNetworksLoading] = useState(false);

  useEffect(() => {
    marketAPI.getCoins().then((res: any) => {
      setCoins((res.data || []).filter((c: any) => c.is_deposit));
    });
  }, []);

  const filtered = coins.filter((c: any) =>
    !search ||
    c.symbol?.toLowerCase().includes(search.toLowerCase()) ||
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  // When a coin is selected, fetch ONLY the networks it actually supports
  const handleCoinSelect = async (coin: any) => {
    setSelectedCoin(coin);
    setShowNetworkSheet(true);
    setNetworksLoading(true);
    setCoinNetworks([]);
    try {
      const res: any = await walletAPI.getCoinNetworks(coin.symbol);
      const list = (res as any)?.data || res || [];
      setCoinNetworks(Array.isArray(list) ? list : []);
    } catch {
      toast.error('Failed to load supported networks');
    } finally {
      setNetworksLoading(false);
    }
  };

  const handleNetworkSelect = async (network: any) => {
    setShowNetworkSheet(false);
    setLoading(true);
    try {
      const res: any = await walletAPI.getDepositAddress(selectedCoin.symbol, network.network);
      setDepositInfo({ ...res.data, network_name: network.network_name });
      setStep('address');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to get address');
    } finally { setLoading(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(depositInfo.address);
    setCopied(true);
    toast.success('Address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh',
                  display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12,
                    padding: '0 16px', height: 56, flexShrink: 0,
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => step === 'address' ? setStep('coin') : navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
                   color: 'var(--color-text)', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>
          {step === 'coin' ? 'Select Crypto' : 'Deposit'}
        </span>
      </div>

      {/* ── METHOD SHEET ── */}
      <BottomSheet open={showMethodSheet && step === 'coin'}
        onClose={() => setShowMethodSheet(false)} height="52vh">
        <div style={{ padding: '8px 20px 20px', flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 20,
                        textAlign: 'center' }}>
            Select Deposit Method
          </div>

          {[
            {
              icon: <ArrowDownToLine size={22} color="var(--color-success)" />,
              bg: '#0ecb8118', label: 'Deposit Crypto',
              sub: 'From external wallet or exchange',
              onClick: () => setShowMethodSheet(false), opacity: 1
            },
            {
              icon: <CreditCard size={22} color="#1890ff" />,
              bg: '#1890ff18', label: 'Buy with Card',
              sub: 'Pay with credit/debit card', badge: 'Soon',
              onClick: () => toast('Coming Soon'), opacity: 1
            },
            {
              icon: <Users size={22} color="#722ed1" />,
              bg: '#722ed118', label: 'P2P Trading',
              sub: 'Buy directly from users', badge: 'Soon',
              onClick: () => toast('Coming Soon'), opacity: 0.55
            },
          ].map((item, i) => (
            <div key={i} onClick={item.onClick} style={{
              padding: '16px', borderRadius: 14, marginBottom: 10,
              background: 'var(--color-surface2)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: 14, opacity: item.opacity
            }}>
              <div style={{ width: 46, height: 46, borderRadius: 14,
                            background: item.bg, flexShrink: 0,
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center' }}>
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 10,
                                   background: '#f0b90b20', color: 'var(--color-primary)',
                                   fontWeight: 700 }}>{item.badge}</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 3 }}>
                  {item.sub}
                </div>
              </div>
              <ChevronRight size={16} color="var(--color-muted)" />
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* ── COIN SELECT ── */}
      {step === 'coin' && !showMethodSheet && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                      overflow: 'hidden' }}>

          {/* Sticky search */}
          <div style={{ padding: '12px 16px', flexShrink: 0,
                        background: 'var(--color-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                          background: 'var(--color-surface)', borderRadius: 24,
                          padding: '11px 16px',
                          border: '1px solid var(--color-border)' }}>
              <Search size={15} color="var(--color-muted)" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search coin..."
                style={{ flex: 1, background: 'none', border: 'none',
                         color: 'var(--color-text)', fontSize: 15,
                         outline: 'none' }} autoFocus />
              {search && (
                <button onClick={() => setSearch('')} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-muted)', display: 'flex'
                }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Sticky label */}
          <div style={{ padding: '4px 16px 8px', fontSize: 13, flexShrink: 0,
                        color: 'var(--color-muted)', fontWeight: 600,
                        background: 'var(--color-bg)' }}>
            {search ? 'Search Results' : 'All Coins'}
          </div>

          {/* Scrollable list only */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.map((coin: any) => (
              <div key={coin.symbol}
                onClick={() => handleCoinSelect(coin)}
                style={{ display: 'flex', alignItems: 'center', gap: 12,
                         padding: '14px 16px', cursor: 'pointer',
                         borderBottom: '1px solid var(--color-border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {coin.logo_url
                  ? <img src={coin.logo_url} alt=""
                      style={{ width: 40, height: 40, borderRadius: '50%' }}
                      onError={(e) => { (e.target as any).style.display = 'none'; }} />
                  : <div style={{ width: 40, height: 40, borderRadius: '50%',
                                  background: 'var(--color-surface)', display: 'flex',
                                  alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 800, color: 'var(--color-primary)', fontSize: 15 }}>
                      {coin.symbol?.charAt(0)}
                    </div>
                }
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15,
                                color: 'var(--color-text)' }}>{coin.symbol}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                    {coin.name}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--color-muted)" />
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40,
                            color: 'var(--color-muted)', fontSize: 14 }}>
                No coins found
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── NETWORK SHEET (now dynamic, per-coin) ── */}
      <BottomSheet open={showNetworkSheet}
        onClose={() => setShowNetworkSheet(false)} height="58vh">
        <div style={{ display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 20px 14px', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Select Network</span>
          <button onClick={() => setShowNetworkSheet(false)} style={{
            background: 'var(--color-surface2)', border: 'none', cursor: 'pointer',
            borderRadius: '50%', width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <X size={16} color="var(--color-muted)" />
          </button>
        </div>

        <div style={{ margin: '0 16px 14px', padding: '10px 14px', borderRadius: 10,
                      background: '#f0b90b10', border: '1px solid #f0b90b25',
                      fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5,
                      flexShrink: 0 }}>
          Only send assets on the selected network. Wrong network = funds lost permanently.
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px' }}>
          {networksLoading && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-muted)', fontSize: 13 }}>
              Loading networks...
            </div>
          )}

          {!networksLoading && coinNetworks.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-muted)', fontSize: 13 }}>
              No deposit networks available for {selectedCoin?.symbol}
            </div>
          )}

          {!networksLoading && coinNetworks.map((net: any) => {
            const visual = getNetworkVisual(net.network);
            return (
              <div key={net.network} onClick={() => handleNetworkSelect(net)}
                style={{ display: 'flex', alignItems: 'center', gap: 12,
                         padding: '14px 16px', borderRadius: 14, marginBottom: 10,
                         background: 'var(--color-surface2)',
                         border: '1px solid var(--color-border)', cursor: 'pointer',
                         transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = visual.color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}>

                {/* Network logo */}
                <div style={{ width: 42, height: 42, borderRadius: '50%',
                              background: visual.color + '20', flexShrink: 0,
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'center', overflow: 'hidden' }}>
                  {visual.logo ? (
                    <img src={visual.logo} alt={net.network}
                      style={{ width: 42, height: 42, borderRadius: '50%',
                               objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as any).style.display = 'none';
                        (e.target as any).parentElement.innerHTML =
                          `<span style="font-weight:800;color:${visual.color};font-size:14px">${net.network}</span>`;
                      }} />
                  ) : (
                    <span style={{ fontWeight: 800, color: visual.color, fontSize: 14 }}>
                      {net.network}
                    </span>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15,
                                color: 'var(--color-text)' }}>{net.network_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 3 }}>
                    ~{net.min_confirmations ?? visual.confirmations} confirmations
                  </div>
                </div>
                <ChevronRight size={16} color="var(--color-muted)" />
              </div>
            );
          })}
        </div>
      </BottomSheet>

      {/* ── ADDRESS PAGE ── */}
      {step === 'address' && depositInfo && !loading && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                      padding: '20px 20px 28px' }}>

          {/* Coin selector */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <button onClick={() => { setStep('coin'); setShowNetworkSheet(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8,
                       background: 'var(--color-surface)',
                       border: '1px solid var(--color-border)',
                       borderRadius: 24, padding: '8px 16px', cursor: 'pointer' }}>
              {selectedCoin?.logo_url && (
                <img src={selectedCoin.logo_url} alt=""
                  style={{ width: 22, height: 22, borderRadius: '50%' }} />
              )}
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
                {selectedCoin?.symbol}
              </span>
              <ChevronRight size={14} color="var(--color-muted)" />
            </button>
          </div>

          {/* QR code */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ padding: 14, background: '#fff', borderRadius: 18,
                          boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}>
              <QRCodeSVG value={depositInfo.address} size={150} level="M" />
            </div>
          </div>

          {/* Network */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 3 }}>
              Network
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
              {depositInfo.network_name}
            </div>
          </div>

          {/* Address with inline copy */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>
              Deposit address
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 12,
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          display: 'flex', alignItems: 'flex-start',
                          gap: 10 }}>
              <div style={{ flex: 1 }}>
                <HighlightedAddress address={depositInfo.address} />
              </div>
              {/* Inline copy button */}
              <button onClick={handleCopy} style={{
                background: copied ? 'var(--color-success)' : 'var(--color-surface2)',
                border: 'none', cursor: 'pointer', borderRadius: 10,
                width: 36, height: 36, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s'
              }}>
                {copied
                  ? <Check size={16} color="#fff" />
                  : <Copy size={16} color="var(--color-muted)" />
                }
              </button>
            </div>
          </div>

          {/* Info rows */}
          <div style={{ flex: 1 }}>
            {[
              { label: 'Min. deposit amount',
                value: `${parseFloat(depositInfo.min_deposit || 0.1).toFixed(4)} ${depositInfo.coin?.symbol || selectedCoin?.symbol}` },
              { label: 'Confirmations',
                value: `${depositInfo.confirmations_required || 15} confirmations` },
              { label: 'Contract address',
                value: depositInfo.contract_address
                  ? `ends with ${depositInfo.contract_address.slice(-6)}`
                  : 'Native' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                                        padding: '9px 0',
                                        borderBottom: '1px solid var(--color-border)',
                                        fontSize: 13 }}>
                <span style={{ color: 'var(--color-muted)' }}>{label}</span>
                <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Share + Copy buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                        gap: 12, marginTop: 20 }}>
            <button onClick={() => {
              if (navigator.share) {
                navigator.share({ title: 'Deposit Address', text: depositInfo.address });
              } else { handleCopy(); }
            }} style={{
              padding: '15px', borderRadius: 50,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)', fontWeight: 700,
              cursor: 'pointer', fontSize: 15,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 6
            }}>
              <Share2 size={16} /> Share
            </button>
            <button onClick={handleCopy} style={{
              padding: '15px', borderRadius: 50, border: 'none',
              background: copied ? 'var(--color-success)' : '#fff',
              color: copied ? '#fff' : '#000',
              fontWeight: 700, cursor: 'pointer', fontSize: 15,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 6
            }}>
              {copied
                ? <><Check size={16} /> Copied!</>
                : <><Copy size={16} /> Copy address</>
              }
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'var(--color-muted)' }}>
          Getting address...
        </div>
      )}
    </div>
  );
}
