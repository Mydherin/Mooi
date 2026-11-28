import { Link } from 'react-router-dom';
import { projectPath } from '@/app/paths';
import { Eyebrow } from '@/shared/components/data-display/Eyebrow';
import { Initials } from '@/shared/components/data-display/Initials';
import { useProjectsStore } from '@/stores/projectsStore';

const SIDEBAR_PROJECTS = 6;

/** Shortcuts to the latest projects; only rendered once there is a workspace, so no heading promises an empty list. */
export const AppSidebarProjects = () => {
  const projects = useProjectsStore((state) => state.projects);
  const recent = projects.slice(0, SIDEBAR_PROJECTS);
  if (recent.length === 0) return <div className="min-h-0 flex-1" />;

  return (
    <div data-scroller className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-7 pb-3">
      <Eyebrow className="px-2.5">Recent projects</Eyebrow>
      <div className="mt-2 flex flex-col gap-0.5">
        {recent.map((project) => (
          <Link key={project.id} to={projectPath(project.id)}
            className="group/project flex h-9 items-center gap-2.5 rounded-control px-2.5 text-footnote font-medium text-ink-muted transition-colors duration-150 hover-device:hover:bg-surface/60 hover-device:hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <Initials value={project.name} size="sm" />
            <span className="truncate">{project.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};
