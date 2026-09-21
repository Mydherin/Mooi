import { NavLink } from 'react-router-dom';
import type { AppNavLink } from '@/shared/types/AppNavLink';
import { cn } from '@/shared/utils/cn';

interface AppNavItemProps {
  link: AppNavLink;
  onNavigate?: () => void;
}

export const AppNavItem = ({ link, onNavigate }: AppNavItemProps) => {
  const Icon = link.icon;

  return (
    <NavLink
      to={link.to}
      end={link.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          isActive ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
        )
      }
    >
      <Icon className="size-4.5 shrink-0" />
      {link.label}
      {link.adminOnly ? (
        <span className="ml-auto text-[9px] font-extrabold tracking-[0.08em] text-ink-subtle uppercase">
          Admin only
        </span>
      ) : null}
    </NavLink>
  );
};
