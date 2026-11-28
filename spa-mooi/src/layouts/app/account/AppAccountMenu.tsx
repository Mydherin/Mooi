import { LogOut, MoonStar, Sun, UserRound } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { AccountSummary } from '@/layouts/app/account/AccountSummary';
import { Avatar } from '@/shared/components/data-display/Avatar';
import { Menu } from '@/shared/components/overlays/menu/Menu';
import { cn } from '@/shared/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

interface AppAccountMenuProps {
  collapsed: boolean;
}

/** The foot of the desktop sidebar: the player, their profile, the theme and signing out. */
export const AppAccountMenu = ({ collapsed }: AppAccountMenuProps) => {
  const player = useAuthStore((state) => state.player);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const { busy, signOutHere } = useSignOut();
  if (!player) return null;

  return (
    <Menu label="Account" placement="top-start" width="md" header={<AccountSummary player={player} />}
      sections={[
        { id: 'account', items: [
          { id: 'profile', label: 'My profile', icon: UserRound, to: ROUTES.account },
          { id: 'theme', label: theme === 'dark' ? 'Light theme' : 'Dark theme', icon: theme === 'dark' ? Sun : MoonStar, onSelect: toggleTheme, keepOpen: true },
        ] },
        { id: 'session', items: [{ id: 'sign-out', label: busy ? 'Signing out…' : 'Log out', icon: LogOut, destructive: true, disabled: busy, onSelect: signOutHere }] },
      ]}
      renderTrigger={(props) => (
        <button {...props} type="button" aria-label="Open the account menu"
          className={cn('flex w-full min-w-0 items-center gap-2.5 rounded-control p-1.5 text-left transition-colors hover-device:hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
            props['aria-expanded'] && 'bg-surface-2', collapsed && 'justify-center')}>
          <Avatar src={player.avatarUrl} name={player.username} size="sm" />
          {collapsed ? null : (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{player.username}</span>
              <span className="block truncate text-[11px] text-ink-subtle">{player.email}</span>
            </span>
          )}
        </button>
      )} />
  );
};
