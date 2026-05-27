import { useNavigate } from 'react-router-dom';
import { Shield, ArrowRight, User, CheckCircle } from 'lucide-react';

interface Props {
  profileComplete: boolean;
  kycLevel: number;
}

export default function OnboardingBanner({ profileComplete, kycLevel }: Props) {
  const navigate = useNavigate();

  const steps = [
    { done: profileComplete, label: 'Complete Profile', action: '/profile', icon: User },
    { done: kycLevel > 0,    label: 'Verify KYC',      action: '/kyc',     icon: Shield },
  ];

  const allDone = steps.every(s => s.done);
  if (allDone) return null;

  const next = steps.find(s => !s.done);

  return (
    <div onClick={() => next && navigate(next.action)}
      style={{ margin: '12px 16px', padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
               background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
               border: '1px solid rgba(240,185,11,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#f0b90b', marginBottom: 6 }}>
            Complete Your Account Setup
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {steps.map(({ done, label, icon: Icon }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {done
                  ? <CheckCircle size={14} color="#0ecb81" />
                  : <Icon size={14} color="#848e9c" />
                }
                <span style={{ fontSize: 12,
                               color: done ? '#0ecb81' : '#848e9c',
                               textDecoration: done ? 'line-through' : 'none' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <ArrowRight size={20} color="#f0b90b" />
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 10, height: 3, borderRadius: 2,
                    background: 'rgba(255,255,255,0.1)' }}>
        <div style={{ height: '100%', borderRadius: 2,
                      background: '#f0b90b',
                      width: `${(steps.filter(s => s.done).length / steps.length) * 100}%`,
                      transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}
