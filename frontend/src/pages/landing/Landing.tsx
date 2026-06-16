import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { marketAPI } from '../../services/api';
import { subscribeToTicker } from '../../services/socket';

import LandingHeader   from './components/LandingHeader';
import HeroSection     from './components/HeroSection';
import MarketSection   from './components/MarketSection';
import FeaturesSection from './components/FeaturesSection';
import StepsSection    from './components/StepsSection';
import CTASection      from './components/CTASection';
import LandingFooter   from './components/LandingFooter';

export default function Landing() {
  const navigate = useNavigate();
  const { isLoggedIn } = useStore();
  const [pairs, setPairs]           = useState<any[]>([]);
  const [prices, setPricesLocal]    = useState<Record<string, any>>({});
  const [footerPages, setFooterPages] = useState<any[]>([]);
  const [announcement, setAnnouncement] = useState<any>(null);

  useEffect(() => {
    if (isLoggedIn) navigate('/home');
  }, [isLoggedIn]);

  useEffect(() => {
    marketAPI.getPairs().then((res: any) => {
      setPairs(res.data || []);
      res.data?.slice(0, 10).forEach((p: any) => {
        subscribeToTicker(p.symbol, (data: any) => {
          setPricesLocal(prev => ({ ...prev, [p.symbol]: data }));
        });
      });
    }).catch(() => {});

    fetch('/api/v1/market/pages/footer')
      .then(r => r.json())
      .then(d => setFooterPages(d.data || []))
      .catch(() => {});

    fetch('/api/v1/market/announcements')
      .then(r => r.json())
      .then(d => { const anns = d.data || []; if (anns.length > 0) setAnnouncement(anns[0]); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '100vh' }}>
      <LandingHeader />
      <HeroSection announcement={announcement} />
      <MarketSection pairs={pairs} prices={prices} />
      <FeaturesSection />
      <StepsSection />
      <CTASection />
      <LandingFooter footerPages={footerPages} />
    </div>
  );
}
