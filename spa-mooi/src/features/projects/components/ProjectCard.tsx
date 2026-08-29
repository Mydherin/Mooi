import { Link } from 'react-router-dom';
import { Clock, FolderGit2, GitBranch, Star } from 'lucide-react';
import { projectPath } from '@/app/paths';
import type { Project } from '@/features/projects/types/Project';
import { Badge } from '@/shared/components/Badge';
import { Card } from '@/shared/components/Card';
import { formatDate } from '@/shared/utils/formatDate';

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard = ({ project }: ProjectCardProps) => (
  <Card
    as="article"
    className="h-full transition duration-200 hover:-translate-y-0.5 hover:border-line-strong"
  >
    <Link
      to={projectPath(project.id)}
      className="flex h-full flex-col p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <FolderGit2 className="size-4 shrink-0 text-ink-subtle" />
          <span className="truncate font-mono text-xs text-ink-subtle">{project.fullName}</span>
        </span>
        <Badge tone={project.isPrivate ? 'neutral' : 'info'}>
          {project.isPrivate ? 'Private' : 'Public'}
        </Badge>
      </div>

      <h3 className="mt-4 text-base font-semibold tracking-tight text-ink">{project.name}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">
        {project.description ?? 'No description on GitHub.'}
      </p>

      {project.language ? (
        <div className="mt-4">
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-ink-muted">
            {project.language}
          </span>
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-xs text-ink-subtle">
        <span className="flex min-w-0 items-center gap-1.5">
          <GitBranch className="size-3.5 shrink-0" />
          <span className="truncate font-mono">{project.defaultBranch ?? '—'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Star className="size-3.5" />
          {project.stars}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
          Added {formatDate(project.addedAt)}
        </span>
      </div>
    </Link>
  </Card>
);
