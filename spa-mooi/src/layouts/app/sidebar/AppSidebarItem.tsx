import { NavLink } from 'react-router-dom';
import type { AppNavLink } from '@/layouts/app/types/AppNavLink';
import { Tooltip } from '@/shared/components/overlays/tooltip/Tooltip';
import { cn } from '@/shared/utils/cn';
import { formatCount } from '@/shared/utils/formatCount';

interface AppSidebarItemProps {
  link: AppNavLink;
  collapsed: boolean;
}

/** The active row is lifted onto a surface with a brand bar at its edge: where you are, at a glance. */
export const AppSidebarItem = ({ link, collapsed }: AppSidebarItemProps) => {
  const Icon = link.icon;
  const item = (
    <NavLink
      to={link.to}
      end={link.end}
      aria-label={collapsed ? link.label : undefined}
      className={({ isActive }) =>
        cn(
          'group/nav relative flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-footnote font-medium transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          collapsed && 'justify-center px-0',
          isActive ? 'bg-surface text-ink shadow-card ring-1 ring-line' : 'text-ink-muted hover-device:hover:bg-surface/60 hover-device:hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span aria-hidden className={cn('absolute top-1/2 -left-3 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-gradient transition-[opacity,transform] duration-200',
            isActive ? 'opacity-100' : 'scale-y-0 opacity-0')} />
          <Icon aria-hidden className={cn('size-4 shrink-0 transition-colors', isActive ? 'text-brand' : 'text-ink-subtle group-hover/nav:text-ink-muted')} />
          {collapsed ? null : <span className="truncate">{link.label}</span>}
          {link.attention ? (
            <span title={`${link.attention} waiting for you`}
              className={cn('inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-warning-dot px-1.5 text-[10px] font-bold text-white tabular-nums',
                collapsed ? 'absolute -top-1 -right-1' : 'ml-auto')}>
              {formatCount(link.attention)}
            </span>
          ) : null}
          {link.adminOnly && !collapsed ? (
            <span className="ml-auto rounded-full border border-line px-1.5 py-px font-mono text-[9px] font-medium tracking-[0.08em] text-ink-subtle uppercase">
              Admin
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );

  return collapsed ? <Tooltip content={link.label} placement="bottom" mono={false} className="flex w-full">{item}</Tooltip> : item;
};
