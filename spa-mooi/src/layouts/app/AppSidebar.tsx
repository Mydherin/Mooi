import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { projectPath } from '@/app/paths';
import { AppNavItem } from '@/layouts/app/AppNavItem';
import { appNavLinks } from '@/layouts/app/appNavLinks';
import { AppUserCard } from '@/layouts/app/AppUserCard';
import { Logo } from '@/shared/components/Logo';
import { cn } from '@/shared/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useProjectsStore } from '@/stores/projectsStore';

interface AppSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

const SIDEBAR_PROJECTS = 6;

export const AppSidebar = ({ className, onNavigate }: AppSidebarProps) => {
  const player = useAuthStore((state) => state.player);
  const projects = useProjectsStore((state) => state.projects);
  const links = appNavLinks.filter((link) => !link.adminOnly || player?.role === 'admin');
  const sidebarProjects = projects.slice(0, SIDEBAR_PROJECTS);

  return (
    <aside className={cn('flex flex-col border-line bg-surface', className)}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-3">
        <Link
          to={ROUTES.home}
          onClick={onNavigate}
          className="rounded-xl px-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <Logo />
        </Link>

        <Link
          to={ROUTES.projects}
          onClick={onNavigate}
          aria-label="Add a repository"
          title="Add a repository"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-ink-muted transition duration-200 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Plus className="size-4.5" />
        </Link>
      </div>

      <nav className="flex flex-col gap-1 px-3 pt-2">
        {links.map((link) => (
          <AppNavItem key={link.id} link={link} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Only rendered once there is a workspace: an empty heading would promise a list that the
          player has not created yet. */}
      {sidebarProjects.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-6">
          <p className="px-3 text-xs font-semibold tracking-[0.18em] text-ink-subtle uppercase">
            Projects
          </p>
          <div className="mt-2 flex flex-col gap-0.5">
            {sidebarProjects.map((project) => (
              <Link
                key={project.id}
                to={projectPath(project.id)}
                onClick={onNavigate}
                className="flex h-10 items-center rounded-xl px-3 text-sm text-ink-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span className="truncate">{project.name}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1" />
      )}

      {player ? (
        <div className="shrink-0 border-t border-line p-3">
          <AppUserCard player={player} onNavigate={onNavigate} />
        </div>
      ) : null}
    </aside>
  );
};
