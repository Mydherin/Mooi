import { Outlet } from 'react-router-dom';
import { MarketingFooter } from '@/layouts/marketing/MarketingFooter';
import { MarketingHeader } from '@/layouts/marketing/MarketingHeader';

export const MarketingLayout = () => (
  <div className="flex min-h-dvh flex-col bg-canvas text-ink">
    <MarketingHeader />
    <main className="flex-1">
      <Outlet />
    </main>
    <MarketingFooter />
  </div>
);
