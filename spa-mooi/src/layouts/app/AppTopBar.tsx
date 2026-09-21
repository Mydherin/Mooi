import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { AppConnectionPills } from '@/layouts/app/AppConnectionPills';
import { AppUserMenu } from '@/layouts/app/AppUserMenu';
import { IconButton } from '@/shared/components/IconButton';
import { Logo } from '@/shared/components/Logo';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { useSidebarStore } from '@/stores/sidebarStore';

/**
 * The slim bar every screen sits under: the state of the connections, and the session.
 *
 * The account menu appears only below `lg` because above it the sidebar user card already owns the
 * player; two account surfaces on one screen would be two places to drift apart.
 */
export const AppTopBar = () => {
  const open = useSidebarStore((state) => state.open);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4 lg:rounded-t-2xl lg:border lg:px-5">
      <IconButton icon={Menu} label="Open navigation" onClick={open} className="lg:hidden" />

      <Link
        to={ROUTES.projects}
        className="rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand lg:hidden"
      >
        <Logo compact />
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <AppConnectionPills />
        <ThemeToggle />
        <span className="lg:hidden">
          <AppUserMenu />
        </span>
      </div>
    </header>
  );
};
