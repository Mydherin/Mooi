import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { sessionPath } from '@/app/paths';
import { sessions } from '@/features/sessions/data/sessions';
import { sessionStatusTone } from '@/features/sessions/lib/sessionStatusTone';
import { AppNavItem } from '@/layouts/app/AppNavItem';
import { appNavLinks } from '@/layouts/app/appNavLinks';
import { AppUserCard } from '@/layouts/app/AppUserCard';
import { IconButton } from '@/shared/components/IconButton';
import { Logo } from '@/shared/components/Logo';
import { StatusDot } from '@/shared/components/StatusDot';
import { cn } from '@/shared/utils/cn';
import { useAuthStore } from '@/stores/authStore';

interface AppSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

const recentSessions = sessions.slice(0, 3);

export const AppSidebar = ({ className, onNavigate }: AppSidebarProps) => {
  const player = useAuthStore((state) => state.player);
  const links = appNavLinks.filter((link) => !link.adminOnly || player?.role === 'admin');

  return (
    <aside className={cn('flex flex-col border-line bg-surface', className)}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-3">
        <Link
          to={ROUTES.projects}
          onClick={onNavigate}
          className="rounded-xl px-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <Logo />
        </Link>
        <IconButton icon={Plus} label="New project" />
      </div>

      <nav className="flex flex-col gap-1 px-3 pt-2">
        {links.map((link) => (
          <AppNavItem key={link.id} link={link} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-6">
        <p className="px-3 text-xs font-semibold tracking-[0.18em] text-ink-subtle uppercase">
          Recent sessions
        </p>
        <div className="mt-2 flex flex-col gap-0.5">
          {recentSessions.map((session) => (
            <Link
              key={session.id}
              to={sessionPath(session.projectId, session.id)}
              onClick={onNavigate}
              className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm text-ink-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <StatusDot tone={sessionStatusTone(session.status)} pulse={session.status === 'working'} />
              <span className="truncate">{session.title}</span>
            </Link>
          ))}
        </div>
      </div>

      {player ? (
        <div className="shrink-0 border-t border-line p-3">
          <AppUserCard player={player} onNavigate={onNavigate} />
        </div>
      ) : null}
    </aside>
  );
};
