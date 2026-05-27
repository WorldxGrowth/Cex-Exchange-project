import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletAPI, marketAPI } from '../../services/api';
import { Copy, ChevronRight, ChevronLeft, X, Search, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

// ================================
// STEP 1: Entry - On-chain / P2P
// ================================
const StepEntry = ({ onOnChain }: any) => (
  <div style={{ padding: '0 16px 24px' }}>
    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 20 }}>
      Deposit
    </div>

    {/* On-chain */}
    <div onClick={onOnChain} style={{
      padding: '16px', borderRadius: 12, marginBottom: 12,
      background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 12,
                    background: 'rgba(14,203,129,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
        📥
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 15 }}>
          On-chain deposit
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
          Deposit crypto from external wallet or exchange
        </div>
      </div>
      <ChevronRight size={18} color="var(--color-muted)" />
    </div>

    {/* P2P */}
    <div style={{
      padding: '16px', borderRadius: 12,
      background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', gap: 14, opacity: 0.5
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 12,
                    background: 'rgba(24,144,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
        🔄
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 15,
                      display: 'flex', alignItems: 'center', gap: 8 }}>
          P2P Trading
          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10,
                         background: 'rgba(240,185,11,0.2)', color: 'var(--color-primary)',
                         fontWeight: 600 }}>Soon</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
          Buy crypto with zero fees via P2P
        </div>
      </div>
    </div>
  </div>
);

// ================================
// STEP 2: Coin Select
// ================================
const StepCoinSelect = ({ coins, onSelect, onBack }: any) => {
  const [search, setSearch] = useState('');
  const filtered = coins.filter((c: any) =>
    !search || c.symbol.toLowerCase().includes(search.toLowerCase()) ||
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
          Select Crypto
        </span>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%',
                                     transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search coin..."
            style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 24,
                     border: '1px solid var(--color-border)', background: 'var(--color-surface2)',
                     color: 'var(--color-text)', fontSize: 14, outline: 'none' }} />
        </div>
      </div>

      {/* Trending label */}
      <div style={{ padding: '4px 16px 8px', fontSize: 12,
                    color: 'var(--color-muted)', fontWeight: 600 }}>
        {search ? 'Search Results' : 'All Coins'}
      </div>

      {/* Coin List */}
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
        {filtered.map((coin: any) => (
          <div key={coin.symbol} onClick={() => onSelect(coin)}
            style={{ display: 'flex', alignItems: 'center', gap: 12,
                     padding: '14px 16px', cursor: 'pointer',
                     borderBottom: '1px solid var(--color-border)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {coin.logo_url
              ? <img src={coin.logo_url} alt=""
                  style={{ width: 36, height: 36, borderRadius: '50%' }}
                  onError={(e) => { (e.target as any).style.display = 'none'; }} />
              : <div style={{ width: 36, height: 36, borderRadius: '50%',
                              background: 'var(--color-surface2)', display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, color: 'var(--color-primary)', fontSize: 13 }}>
                  {coin.symbol?.charAt(0)}
                </div>
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 14 }}>
                {coin.symbol}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 1 }}>
                {coin.name}
              </div>
            </div>
            <ChevronRight size={16} color="var(--color-muted)" />
          </div>
        ))}
      </div>
    </div>
  );
};

// ================================
// STEP 3: Network Select
// ================================
const StepNetworkSelect = ({ coin, networks, onSelect, onBack }: any) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none',
               cursor: 'pointer', color: 'var(--color-text)' }}>
        <ChevronLeft size={22} />
      </button>
      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
        Select Network
      </span>
    </div>

    {/* Warning */}
    <div style={{ margin: '12px 16px', padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(240,185,11,0.08)', border: '1px solid rgba(240,185,11,0.2)' }}>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
        ⚠️ Only deposit assets of the same type and from the same network. Wrong network = funds lost.
      </div>
    </div>

    {/* Column header */}
    <div style={{ display: 'flex', justifyContent: 'space-between',
                  padding: '8px 16px', fontSize: 11, color: 'var(--color-muted)' }}>
      <span>Network</span>
      <span>Min. deposit</span>
    </div>

    {/* Networks */}
    {networks.map((net: any) => (
      <div key={net.id} onClick={() => onSelect(net)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                 padding: '14px 16px', cursor: 'pointer',
                 borderTop: '1px solid var(--color-border)',
                 margin: '0 16px', borderRadius: 12, marginBottom: 8 }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 14 }}>
            {net.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-success)', marginTop: 3 }}>
            ~{net.confirmations || 15} confirmations
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {parseFloat(coin.min_deposit || 0.1).toFixed(2)} {coin.symbol}
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ================================
// STEP 4: QR + Address
// ================================
const StepAddress = ({ coin, network, depositInfo, onBack, onChangeCoin }: any) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(depositInfo.address);
    setCopied(true);
    toast.success('Address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none',
                 cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>Deposit</span>
        <div style={{ width: 22 }} />
      </div>

      <div style={{ padding: '20px 16px' }}>
        {/* Coin selector at top */}
        <div onClick={onChangeCoin} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          padding: '6px 14px', borderRadius: 24,
          border: '1px solid var(--color-border)',
          marginBottom: 20
        }}>
          {coin.logo_url && (
            <img src={coin.logo_url} alt=""
              style={{ width: 22, height: 22, borderRadius: '50%' }} />
          )}
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
            {coin.symbol}
          </span>
          <ChevronRight size={14} color="var(--color-muted)" />
        </div>

        {/* QR Code */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ padding: 16, background: '#fff', borderRadius: 16,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <QRCodeSVG
              value={depositInfo.address}
              size={160}
              level="M"
              includeMargin={false}
            />
          </div>
        </div>

        {/* Network */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>Network</div>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)' }}>
            {depositInfo.network_name}
          </div>
        </div>

        {/* Address */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>
            Deposit Address
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 12,
                        background: 'var(--color-surface2)',
                        border: '1px solid var(--color-border)',
                        fontSize: 13, color: 'var(--color-text)',
                        wordBreak: 'break-all', lineHeight: 1.6,
                        fontFamily: 'monospace' }}>
            {depositInfo.address}
          </div>
        </div>

        {/* Info rows */}
        {[
          { label: 'Min. deposit amount', value: `${parseFloat(depositInfo.min_deposit || 0.1).toFixed(4)} ${depositInfo.coin}` },
          { label: 'Confirmations', value: `${depositInfo.confirmations} confirmations` },
          { label: 'Contract address', value: depositInfo.contract_address ? `...${depositInfo.contract_address.slice(-8)}` : 'Native' },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                                    padding: '8px 0', borderBottom: '1px solid var(--color-border)',
                                    fontSize: 13 }}>
            <span style={{ color: 'var(--color-muted)' }}>{label}</span>
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{value}</span>
          </div>
        ))}

        {/* Copy + Share buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
          <button onClick={() => {
            if (navigator.share) {
              navigator.share({ title: 'Deposit Address', text: depositInfo.address });
            } else {
              handleCopy();
            }
          }} style={{
            padding: '13px', borderRadius: 10,
            background: 'var(--color-surface2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)', fontWeight: 600, cursor: 'pointer', fontSize: 14
          }}>
            Share
          </button>
          <button onClick={handleCopy} style={{
            padding: '13px', borderRadius: 10,
            background: copied ? 'var(--color-success)' : 'var(--color-text)',
            border: 'none', color: copied ? '#fff' : 'var(--color-bg)',
            fontWeight: 700, cursor: 'pointer', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}>
            {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy address</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ================================
// MAIN DEPOSIT PAGE
// ================================
export default function Deposit() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'entry' | 'coin' | 'network' | 'address'>('entry');
  const [coins, setCoins] = useState<any[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<any>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<any>(null);
  const [depositInfo, setDepositInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    marketAPI.getCoins().then((res: any) => {
      setCoins((res.data || []).filter((c: any) => c.is_deposit));
    });
  }, []);

  const handleCoinSelect = (coin: any) => {
    setSelectedCoin(coin);
    setStep('network');
  };

  const handleNetworkSelect = async (network: any) => {
    setSelectedNetwork(network);
    setLoading(true);
    try {
      const res: any = await walletAPI.getDepositAddress(selectedCoin.symbol);
      setDepositInfo(res.data);
      setStep('address');
    } catch (err: any) {
      toast.error('Failed to get address');
    } finally {
      setLoading(false);
    }
  };

  // Networks for selected coin (from coins data)
  const coinNetworks = selectedCoin ? [
    { id: selectedCoin.network_id, name: selectedCoin.network_name || selectedCoin.network,
      confirmations: selectedCoin.confirmations || 15 }
  ] : [];

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => step === 'entry' ? navigate(-1) : setStep('entry')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>
          {step === 'entry' ? 'Deposit' : step === 'coin' ? 'Select Crypto' :
           step === 'network' ? 'Select Network' : 'Deposit Address'}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-muted)' }}>
          Loading...
        </div>
      ) : (
        <>
          {step === 'entry' && <StepEntry onOnChain={() => setStep('coin')} />}
          {step === 'coin' && (
            <StepCoinSelect coins={coins} onSelect={handleCoinSelect} onBack={() => setStep('entry')} />
          )}
          {step === 'network' && selectedCoin && (
            <StepNetworkSelect
              coin={selectedCoin} networks={coinNetworks}
              onSelect={handleNetworkSelect} onBack={() => setStep('coin')} />
          )}
          {step === 'address' && depositInfo && (
            <StepAddress
              coin={selectedCoin} network={selectedNetwork} depositInfo={depositInfo}
              onBack={() => setStep('network')}
              onChangeCoin={() => setStep('coin')} />
          )}
        </>
      )}
    </div>
  );
}
