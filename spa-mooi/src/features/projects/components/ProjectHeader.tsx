import { Link } from 'react-router-dom';
import { ChevronLeft, ExternalLink, Plus, Settings } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { ProjectStatusBadge } from '@/features/projects/components/ProjectStatusBadge';
import type { Project } from '@/features/projects/types/Project';
import { Button } from '@/shared/components/Button';
import { IconButton } from '@/shared/components/IconButton';
import { buttonStyles } from '@/shared/styles/buttonStyles';

interface ProjectHeaderProps {
  project: Project;
}

export const ProjectHeader = ({ project }: ProjectHeaderProps) => (
  <div>
    <Link to={ROUTES.projects} className={buttonStyles('ghost', 'sm', '-ml-3.5')}>
      <ChevronLeft className="size-4" />
      Projects
    </Link>

    <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {project.name}
          </h1>
          <ProjectStatusBadge status={project.status} />
        </div>

        <a
          href={`https://github.com/${project.repo}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs text-ink-subtle transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {project.repo}
          <ExternalLink className="size-3.5" />
        </a>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {project.description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="brand" size="sm" className="flex-1 lg:flex-none">
          <Plus className="size-4" />
          New session
        </Button>
        <a
          href={`https://${project.productionUrl}`}
          target="_blank"
          rel="noreferrer"
          className={buttonStyles('secondary', 'sm', 'flex-1 lg:flex-none')}
        >
          <ExternalLink className="size-4" />
          Open production
        </a>
        <IconButton icon={Settings} label="Project settings" />
      </div>
    </div>
  </div>
);
