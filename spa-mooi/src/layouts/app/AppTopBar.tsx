import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { AppUserMenu } from '@/layouts/app/AppUserMenu';
import { IconButton } from '@/shared/components/IconButton';
import { Logo } from '@/shared/components/Logo';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { useImmersiveRoute } from '@/layouts/app/useImmersiveRoute';
import { cn } from '@/shared/utils/cn';
import { useSidebarStore } from '@/stores/sidebarStore';

/**
 * The slim bar every screen sits under.
 *
 * The account menu appears only below `lg` because above it the sidebar user card already owns the
 * player; two account surfaces on one screen would be two places to drift apart. Detail screens
 * (session, deployment, backup) own a header with a back button, so on phones this bar steps aside
 * for them, the way a native navigation stack shows one bar at a time.
 */
export const AppTopBar = () => {
  const open = useSidebarStore((state) => state.open);
  const immersive = useImmersiveRoute();

  return (
    <header className={cn('sticky top-0 z-30 flex h-14 composing:max-lg:hidden shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4 lg:rounded-t-2xl lg:border lg:px-5', immersive && 'max-lg:hidden')}>
      <IconButton icon={Menu} label="Open navigation" onClick={open} className="lg:hidden" />

      <Link
        to={ROUTES.projects}
        className="rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand lg:hidden"
      >
        <Logo compact />
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <span className="lg:hidden">
          <AppUserMenu />
        </span>
      </div>
    </header>
  );
};
