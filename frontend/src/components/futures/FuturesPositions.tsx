import { useState } from 'react';
import { ClipboardList } from 'lucide-react';

const TABS = [
  { key: 'positions', label: 'Positions' },
  { key: 'orders',    label: 'Orders'    },
  { key: 'copy',      label: 'Copy trades' },
];

export default function FuturesPositions() {
  const [active, setActive]           = useState('positions');
  const [showCurrent, setShowCurrent] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden',
                  borderTop: '1px solid var(--color-border)', height: '100%' }}>

      {/* Tabs row */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0,
                    background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setActive(key)} style={{
            padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: active === key ? 600 : 400,
            color: active === key ? 'var(--color-text)' : 'var(--color-muted)',
            borderBottom: active === key
              ? '2px solid var(--color-primary)' : '2px solid transparent',
            whiteSpace: 'nowrap'
          }}>
            {label}{(key === 'positions' || key === 'orders') ? ' (0)' : ''}
          </button>
        ))}

        {/* History icon */}
        <button style={{ marginLeft: 'auto', padding: '8px 10px', background: 'none',
                         border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}>
          <ClipboardList size={16} />
        </button>
      </div>

      {/* Show current + Close all — only for positions/orders */}
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
          <button style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6,
                           fontSize: 11, fontWeight: 600,
                           border: '1px solid var(--color-border)',
                           background: 'var(--color-surface2)',
                           color: 'var(--color-text)', cursor: 'pointer' }}>
            Close all
          </button>
        </div>
      )}

      {/* Empty state */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-muted)', fontSize: 13 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
        <div>No {active}</div>
      </div>
    </div>
  );
}
