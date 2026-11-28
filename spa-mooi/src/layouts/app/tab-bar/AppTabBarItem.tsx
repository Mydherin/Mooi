import { NavLink } from 'react-router-dom';
import type { AppNavLink } from '@/layouts/app/types/AppNavLink';
import { cn } from '@/shared/utils/cn';
import { formatCount } from '@/shared/utils/formatCount';

interface AppTabBarItemProps {
  link: AppNavLink;
}

const itemClass = 'group/tab relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold tracking-[0.01em] transition-colors duration-150 active:scale-95 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brand';

/** The pill behind the active icon springs in, so the move between tabs reads at a glance. */
export const TabIndicator = ({ active }: { active: boolean }) => (
  <span aria-hidden className={cn('absolute top-1.5 h-8 w-14 rounded-full bg-brand-soft transition-[opacity,transform] duration-300 ease-spring',
    active ? 'scale-100 opacity-100' : 'scale-50 opacity-0')} />
);

export const TabBadge = ({ count }: { count: number }) => (
  <span className="absolute top-1 left-[calc(50%+6px)] inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warning-dot px-1 text-[9.5px] font-bold text-white tabular-nums ring-2 ring-surface">
    {formatCount(count)}
  </span>
);

export const tabItemClass = (active: boolean): string => cn(itemClass, active ? 'text-brand-strong' : 'text-ink-subtle');

export const AppTabBarItem = ({ link }: AppTabBarItemProps) => {
  const Icon = link.icon;

  return (
    <NavLink to={link.to} end={link.end} className={({ isActive }) => tabItemClass(isActive)}
      aria-label={link.attention ? `${link.label}, ${link.attention} waiting for you` : undefined}>
      {({ isActive }) => (
        <>
          <TabIndicator active={isActive} />
          <Icon aria-hidden className="relative size-5.5" strokeWidth={isActive ? 2.25 : 2} />
          <span className="relative max-w-full truncate px-1">{link.label}</span>
          {link.attention ? <TabBadge count={link.attention} /> : null}
        </>
      )}
    </NavLink>
  );
};
