import { useCallback, useRef, useState } from 'react';
import { ChevronDown, LogOut, MonitorSmartphone, ShieldCheck, UserRound } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { AppUserMenuAction } from '@/layouts/app/AppUserMenuAction';
import { Avatar } from '@/shared/components/Avatar';
import { Badge } from '@/shared/components/Badge';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { useOnEscape } from '@/shared/hooks/useOnEscape';
import { cn } from '@/shared/utils/cn';
import { useAuthStore } from '@/stores/authStore';

/**
 * The player, and everything that can be done to their session, from wherever they happen to be.
 *
 * A menu rather than a screen: signing out acts on the session, it is not a setting to visit, and
 * putting it on a page turned leaving into something to navigate to. One panel serves desktop and
 * mobile — anchored to the avatar, sized for a thumb, capped to the viewport — so no second
 * mobile-only surface can drift away from this one.
 *
 * Ending every session is a two-step control: the first press only arms it. It is the single
 * action here that reaches devices the player is not holding, and there is no undo for it.
 */
export const AppUserMenu = () => {
  const player = useAuthStore((state) => state.player);
  const { busy, signOutHere, signOutFromEveryDevice } = useSignOut();
  const [isOpen, setOpen] = useState(false);
  const [confirmEveryDevice, setConfirmEveryDevice] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setConfirmEveryDevice(false);
  }, []);

  useOnClickOutside(containerRef, close, isOpen);
  useOnEscape(close, isOpen);

  if (!player) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Open the account menu"
        onClick={() => (isOpen ? close() : setOpen(true))}
        className={cn(
          'flex h-10 items-center gap-1 rounded-xl px-1 transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          isOpen ? 'bg-surface-2' : 'hover:bg-surface-2',
        )}
      >
        <Avatar src={player.avatarUrl} name={player.username} size="sm" />
        <ChevronDown
          className={cn('size-4 text-ink-subtle transition duration-200', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute top-full right-0 z-50 mt-2 w-[min(17rem,calc(100vw-2rem))] origin-top-right animate-menu-in rounded-2xl border border-line bg-surface p-2 shadow-2xl"
        >
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar src={player.avatarUrl} name={player.username} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{player.username}</span>
              <span className="block truncate text-xs text-ink-subtle">{player.email}</span>
            </span>
            <Badge tone={player.role === 'admin' ? 'brand' : 'neutral'} className="capitalize">
              {player.role}
            </Badge>
          </div>

          <div className="my-1 border-t border-line" />

          <AppUserMenuAction icon={UserRound} label="Account" to={ROUTES.account} onClick={close} />
          {player.role === 'admin' ? (
            <AppUserMenuAction icon={ShieldCheck} label="Admin" to={ROUTES.admin} onClick={close} />
          ) : null}

          <div className="my-1 border-t border-line" />

          <AppUserMenuAction
            icon={LogOut}
            label="Log out"
            tone="danger"
            disabled={busy}
            onClick={signOutHere}
          />
          <AppUserMenuAction
            icon={MonitorSmartphone}
            label={confirmEveryDevice ? 'Confirm — every device' : 'Log out everywhere'}
            tone={confirmEveryDevice ? 'danger' : 'default'}
            disabled={busy}
            onClick={() =>
              confirmEveryDevice ? signOutFromEveryDevice() : setConfirmEveryDevice(true)
            }
          />
        </div>
      ) : null}
    </div>
  );
};
