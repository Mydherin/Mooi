import { DeployButton } from './deploy/DeployButton';
import { Link } from 'react-router-dom';
import { ChevronLeft, GitBranch } from 'lucide-react';
import { projectPath } from '@/app/paths';
import type { Project } from '@/features/projects/types/Project';
import type { Session } from '@/features/sessions/types/Session';
import { SessionActionsMenu } from '@/features/sessions/components/SessionActionsMenu';
import { WorkspacePathLabel } from '@/features/sessions/components/WorkspacePathLabel';
import { Tooltip } from '@/shared/components/Tooltip';

interface WorkspaceHeaderProps {
  project: Project;
  session: Session;
  deployEnabled: boolean;
  onClose: () => void;
  closeBusy: boolean;
}

/**
 * The branch is the session's name, so it gets every pixel the controls do not need: icon-only
 * deploy on phones, secondary actions (close included) folded into one menu, and up to two lines
 * for long branch names before truncating.
 */
export const WorkspaceHeader = ({
  project,
  session,
  deployEnabled,
  onClose,
  closeBusy,
}: WorkspaceHeaderProps) => (
  <div className="flex shrink-0 items-center gap-1.5 border-b border-line bg-surface py-2 pr-2 pl-1.5 sm:gap-3 sm:px-5 sm:py-2.5">
    <Link
      to={projectPath(project.id)}
      aria-label={`Back to ${project.name}`}
      title={`Back to ${project.name}`}
      className="flex size-10 shrink-0 items-center justify-center rounded-[10px] text-ink-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <ChevronLeft className="size-4.5" />
    </Link>

    <div className="min-w-0 flex-1">
      <p className="hidden truncate text-[11px] font-bold text-ink-subtle sm:block">
        {project.name} <span className="text-line-strong">/</span> {session.providerLabel}
      </p>
      <Tooltip content={session.branch} className="flex">
        <h1 className="flex min-w-0 items-start gap-1.5 text-[14px] leading-[1.3] font-extrabold tracking-[-0.01em] text-ink sm:items-center sm:text-[16px]">
          <GitBranch className="mt-[3px] size-3.5 shrink-0 text-ink-subtle sm:mt-0 sm:size-4" />
          <span className="line-clamp-2 font-mono break-all sm:line-clamp-1">{session.branch}</span>
        </h1>
      </Tooltip>
      <WorkspacePathLabel path={session.workspacePath} className="mt-0.5" focusable />
    </div>

    <div className="flex shrink-0 items-center gap-1 sm:max-w-[45%] sm:shrink sm:gap-2">
      {deployEnabled ? <DeployButton key={session.id} session={session} disabled={closeBusy} /> : null}
      <SessionActionsMenu session={session} onClose={onClose} closeBusy={closeBusy} />
    </div>
  </div>
);
