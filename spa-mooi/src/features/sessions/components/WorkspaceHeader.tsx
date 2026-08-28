import { Link } from 'react-router-dom';
import { Bot, ChevronLeft, Ellipsis, GitBranch, GitPullRequest } from 'lucide-react';
import { projectPath } from '@/app/paths';
import type { Project } from '@/features/projects/types/Project';
import { DeployButton } from '@/features/sessions/components/deploy/DeployButton';
import { SessionStatusBadge } from '@/features/sessions/components/SessionStatusBadge';
import type { Session } from '@/features/sessions/types/Session';
import { IconButton } from '@/shared/components/IconButton';
import { buttonStyles } from '@/shared/styles/buttonStyles';

interface WorkspaceHeaderProps {
  project: Project;
  session: Session;
}

export const WorkspaceHeader = ({ project, session }: WorkspaceHeaderProps) => (
  <div className="flex shrink-0 flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
    <div className="flex min-w-0 items-center gap-2">
      <Link
        to={projectPath(project.id)}
        aria-label="Back to project"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <ChevronLeft className="size-4" />
      </Link>

      <p className="min-w-0 truncate text-sm text-ink-subtle">
        {project.name} / <span className="font-medium text-ink">{session.title}</span>
      </p>

      <SessionStatusBadge status={session.status} />
    </div>

    <div className="flex items-center gap-2">
      <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 font-mono text-xs text-ink-muted">
        <GitBranch className="size-3.5 shrink-0" />
        <span className="truncate">{session.branch}</span>
      </span>

      <span className="hidden items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-xs text-ink-muted sm:flex">
        <Bot className="size-3.5 shrink-0" />
        {session.provider}
      </span>

      <button type="button" className={buttonStyles('secondary', 'sm', 'ml-auto hidden sm:inline-flex')}>
        <GitPullRequest className="size-4" />
        Open PR
      </button>

      <DeployButton session={session} />

      <IconButton icon={Ellipsis} label="Session actions" className="size-9" />
    </div>
  </div>
);
