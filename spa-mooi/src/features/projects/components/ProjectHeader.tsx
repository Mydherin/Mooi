import { Link } from 'react-router-dom';
import { ChevronRight, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import type { Project } from '@/features/projects/types/Project';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { Eyebrow } from '@/shared/components/Eyebrow';
import { Initials } from '@/shared/components/Initials';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { formatDate } from '@/shared/utils/formatDate';

interface ProjectHeaderProps {
  project: Project;
  busy: boolean;
  onRemove: () => void;
  onNewSession: () => void;
}

export const ProjectHeader = ({ project, busy, onRemove, onNewSession }: ProjectHeaderProps) => (
  <div className="flex flex-col gap-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold">
        <Link
          to={ROUTES.projects}
          className="rounded text-ink-subtle transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Projects
        </Link>
        <ChevronRight className="size-3.5 shrink-0 text-line-strong" />
        <span className="min-w-0 truncate text-ink">{project.name}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        {project.htmlUrl ? (
          <a
            href={project.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonStyles('secondary', 'sm')}
          >
            <ExternalLink className="size-4" />
            Open on GitHub
          </a>
        ) : null}

        <Button variant="danger" size="sm" onClick={onRemove} disabled={busy}>
          <Trash2 className="size-4" />
          Remove project
        </Button>

        <Button variant="brand" size="sm" onClick={onNewSession}>
          <Plus className="size-4" />
          New session
        </Button>
      </div>
    </div>

    <Card className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-start">
      <div className="flex min-w-0 gap-4">
        <Initials value={project.name} size="lg" />

        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2.5">
            <span className="break-words text-[26px] font-extrabold tracking-[-0.035em] text-ink">
              {project.name}
            </span>
            <Badge tone={project.isPrivate ? 'neutral' : 'info'}>
              {project.isPrivate ? 'Private' : 'Public'}
            </Badge>
          </p>

          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-muted">
            {project.description ?? 'No description on GitHub.'}
          </p>

          {project.htmlUrl ? (
            <a
              href={project.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex max-w-full items-center gap-1.5 break-all font-mono text-[11px] text-ink-subtle transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {project.fullName}
              <ExternalLink className="size-3.5 shrink-0" />
            </a>
          ) : (
            <p className="mt-2 font-mono text-[11px] text-ink-subtle">{project.fullName}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:ml-auto lg:grid-cols-4">
        <div>
          <Eyebrow>Default branch</Eyebrow>
          <p className="mt-1 truncate font-mono text-[15px] font-extrabold text-ink">
            {project.defaultBranch ?? '—'}
          </p>
        </div>

        <div>
          <Eyebrow>Language</Eyebrow>
          <p className="mt-1 flex items-center gap-2 truncate text-[15px] font-extrabold text-ink">
            {project.language ? <span className="size-1.5 shrink-0 rounded-full bg-info-dot" /> : null}
            {project.language ?? '—'}
          </p>
        </div>

        <div>
          <Eyebrow>Stars</Eyebrow>
          <p className="mt-1 text-[15px] font-extrabold text-ink">{String(project.stars)}</p>
        </div>

        <div>
          <Eyebrow>Added</Eyebrow>
          <p className="mt-1 text-[15px] font-extrabold text-ink">{formatDate(project.addedAt)}</p>
        </div>
      </div>
    </Card>
  </div>
);
