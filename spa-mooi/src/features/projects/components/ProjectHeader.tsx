import { Link } from 'react-router-dom';
import { ChevronLeft, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import type { Project } from '@/features/projects/types/Project';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { buttonStyles } from '@/shared/styles/buttonStyles';

interface ProjectHeaderProps {
  project: Project;
  busy: boolean;
  onRemove: () => void;
}

export const ProjectHeader = ({ project, busy, onRemove }: ProjectHeaderProps) => (
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
          <Badge tone={project.isPrivate ? 'neutral' : 'info'}>
            {project.isPrivate ? 'Private' : 'Public'}
          </Badge>
        </div>

        {project.htmlUrl ? (
          <a
            href={project.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs text-ink-subtle transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {project.fullName}
            <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <p className="mt-2 font-mono text-xs text-ink-subtle">{project.fullName}</p>
        )}

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {project.description ?? 'No description on GitHub.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="brand" size="sm" className="flex-1 lg:flex-none">
          <Plus className="size-4" />
          New session
        </Button>

        {project.htmlUrl ? (
          <a
            href={project.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonStyles('secondary', 'sm', 'flex-1 lg:flex-none')}
          >
            <ExternalLink className="size-4" />
            Open on GitHub
          </a>
        ) : null}

        <Button variant="danger" size="sm" onClick={onRemove} disabled={busy}>
          <Trash2 className="size-4" />
          Remove
        </Button>
      </div>
    </div>
  </div>
);
