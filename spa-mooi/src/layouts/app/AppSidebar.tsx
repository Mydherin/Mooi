import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { projectPath } from '@/app/paths';
import { AppNavItem } from '@/layouts/app/AppNavItem';
import { AppSidebarUser } from '@/layouts/app/AppSidebarUser';
import { appNavLinks } from '@/layouts/app/appNavLinks';
import { Eyebrow } from '@/shared/components/Eyebrow';
import { Initials } from '@/shared/components/Initials';
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
    <aside className={cn('flex flex-col bg-canvas', className)}>
      <div className="flex h-16 shrink-0 items-center px-4">
        <Link
          to={ROUTES.projects}
          onClick={onNavigate}
          className="rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <Logo />
        </Link>
      </div>

      {onNavigate ? (
        <button
          type="button"
          onClick={onNavigate}
          className="mx-3 mb-1 flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-sm font-bold text-ink-muted hover:bg-surface-2"
        >
          <X className="size-4" />
          Close navigation
        </button>
      ) : null}

      <nav className="flex flex-col gap-0.5 px-3 pt-2">
        {links.map((link) => (
          <AppNavItem key={link.id} link={link} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Only rendered once there is a workspace: an empty heading would promise a list that the
          player has not created yet. */}
      {sidebarProjects.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-8 pb-3">
          <Eyebrow className="px-3">Recent</Eyebrow>
          <div className="mt-2 flex flex-col gap-0.5">
            {sidebarProjects.map((project) => (
              <Link
                key={project.id}
                to={projectPath(project.id)}
                onClick={onNavigate}
                className="flex min-h-11 items-center gap-2.5 rounded-[10px] px-3 text-[13px] font-bold text-ink-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Initials value={project.name} size="sm" />
                <span className="truncate">{project.name}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1" />
      )}

      <AppSidebarUser onNavigate={onNavigate} />
    </aside>
  );
};
