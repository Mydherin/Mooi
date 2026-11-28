import { useState } from 'react';
import { Menu as MenuIcon } from 'lucide-react';
import { useCurrentSection } from '@/layouts/app/navigation/useCurrentSection';
import { useNavLinks } from '@/layouts/app/navigation/useNavLinks';
import { AppMoreSheet } from '@/layouts/app/tab-bar/AppMoreSheet';
import { AppTabBarItem, TabBadge, TabIndicator, tabItemClass } from '@/layouts/app/tab-bar/AppTabBarItem';

/**
 * The phone navigation: four primary destinations and More, frosted over the content at the
 * bottom (thumb reach, home indicator cleared). It steps aside while the keyboard is up and on
 * immersive screens (the layout decides). More opens a sheet with everything else.
 */
export const AppTabBar = () => {
  const links = useNavLinks();
  const section = useCurrentSection();
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = links.filter((link) => link.tab);
  const rest = links.filter((link) => !link.tab);
  const moreActive = moreOpen || rest.some((link) => link.id === section?.id);
  const moreAttention = rest.reduce((sum, link) => sum + (link.attention ?? 0), 0);

  return (
    <>
      <nav aria-label="Main" className="absolute inset-x-0 bottom-0 z-nav border-t border-line bg-frosted pb-(--safe-bottom) keyboard:hidden">
        <div className="flex h-(--tab-bar-height) items-stretch">
          {tabs.map((link) => <AppTabBarItem key={link.id} link={link} />)}
          <button type="button" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)} className={tabItemClass(moreActive)}>
            <TabIndicator active={moreActive} />
            <MenuIcon aria-hidden className="relative size-5.5" strokeWidth={moreActive ? 2.25 : 2} />
            <span className="relative">More</span>
            {moreAttention > 0 ? <TabBadge count={moreAttention} /> : null}
          </button>
        </div>
      </nav>
      <AppMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} links={rest} />
    </>
  );
};
