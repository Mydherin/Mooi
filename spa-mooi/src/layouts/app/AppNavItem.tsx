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
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          isActive
            ? 'bg-brand-soft text-brand'
            : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
        )
      }
    >
      <Icon className="size-4.5 shrink-0" />
      {link.label}
    </NavLink>
  );
};
