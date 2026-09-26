import { Link } from 'react-router-dom';
import { ChevronRight, GitBranch, Globe, Star } from 'lucide-react';
import { projectPath } from '@/app/paths';
import type { Project } from '@/features/projects/types/Project';
import { Badge } from '@/shared/components/Badge';
import { Card } from '@/shared/components/Card';
import { Initials } from '@/shared/components/Initials';
import { formatDate } from '@/shared/utils/formatDate';

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard = ({ project }: ProjectCardProps) => (
  <Card as="article" className="group h-full transition duration-200 hover:border-line-strong">
    <Link
      to={projectPath(project.id)}
      className="flex h-full flex-col p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <div className="flex items-start gap-3">
        <Initials value={project.name} size="md" />
        <span className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-extrabold tracking-[-0.02em] text-ink">
            {project.name}
          </h3>
          <p className="truncate font-mono text-[11px] text-ink-subtle">{project.fullName}</p>
        </span>
        <Badge tone={project.isPrivate ? 'neutral' : 'info'}>
          {project.isPrivate ? 'Private' : 'Public'}
        </Badge>
      </div>

      <p className="mt-4 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">
        {project.description ?? 'No description on GitHub.'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-bold text-ink-muted">
        {project.language ? (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-1.5 rounded-full bg-info-dot" />
            {project.language}
          </span>
        ) : null}
        <span className="flex min-w-0 items-center gap-1.5">
          <GitBranch className="size-3 shrink-0" />
          <span className="truncate font-mono font-normal">{project.defaultBranch ?? '—'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Star className="size-3" />
          {project.stars}
        </span>
        {project.webApplication ? (
          <span className="flex items-center gap-1.5 text-brand-strong">
            <Globe className="size-3" />
            Web app
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3.5 text-[11px] text-ink-subtle">
        Added {formatDate(project.addedAt)}
        <ChevronRight className="size-3.5" />
      </div>
    </Link>
  </Card>
);
