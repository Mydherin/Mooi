import { useState } from 'react';
import { GitBranch } from 'lucide-react';
import type { Project } from '@/features/projects/types/Project';
import type { Session } from '@/features/sessions/types/Session';
import { DeployButton } from '@/features/sessions/components/deploy/DeployButton';
import { MergeButton } from '@/features/sessions/components/merge/MergeButton';
import { LinkedSessionsMenu } from '@/features/sessions/components/LinkedSessionsMenu';
import { SessionAccountIdentity } from '@/features/sessions/components/SessionAccountIdentity';
import { WorkspacePathLabel } from '@/features/sessions/components/WorkspacePathLabel';
import { SessionActionsMenu } from '@/features/sessions/components/session/SessionActionsMenu';
import { SessionDetailsSheet } from '@/features/sessions/components/session/SessionDetailsSheet';
import { useDeployControl } from '@/features/sessions/hooks/useDeployControl';
import { useMerge } from '@/features/sessions/hooks/useMerge';
import { BackButton } from '@/shared/components/navigation/BackButton';
import type { BackLink } from '@/shared/types/BackLink';

interface WorkspaceHeaderProps {
  project: Project;
  session: Session;
  back: BackLink;
  deployEnabled: boolean;
  /** Resolves true once the session is closed (the page then leaves). */
  onClose: () => Promise<boolean>;
  closeBusy: boolean;
  closeError: string | null;
}

/**
 * The branch is the session's name, so it gets every pixel the controls do not need: icon-only
 * merge on phones, the deploy button only while a deployment is active (its other actions join the
 * secondary ones, close included, in one menu), and a title that opens the session details on tap.
 */
export const WorkspaceHeader = ({ project, session, back, deployEnabled, onClose, closeBusy, closeError }: WorkspaceHeaderProps) => {
  const deployControl = useDeployControl(session, closeBusy);
  const deploy = deployEnabled ? deployControl : null;
  const merge = useMerge(session.id);
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <header className="flex shrink-0 items-center gap-1.5 border-b border-line bg-surface py-2 pr-2 pl-1 composing:max-lg:hidden sm:gap-3 sm:pr-5 sm:pl-3 lg:py-2.5">
      <BackButton back={back} compact />

      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => setDetailsOpen(true)} aria-haspopup="dialog"
          className="flex min-h-11 w-full min-w-0 flex-col justify-center rounded-control px-1.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-brand active:bg-surface-2 hover-device:hover:bg-surface-2/60">
          <span className="hidden truncate text-caption font-medium text-ink-subtle sm:block">
            {project.name}{session.title ? <span className="text-ink-muted"> · {session.title}</span> : null}
          </span>
          <h1 className="flex min-w-0 items-center gap-1.5 text-callout font-semibold text-ink sm:text-headline">
            <GitBranch aria-hidden className="size-3.5 shrink-0 text-ink-subtle sm:size-4" />
            <span className="truncate-start min-w-0 font-mono"><span dir="ltr">{session.branch}</span></span>
          </h1>
          <span className="truncate pl-5 text-caption text-ink-subtle sm:hidden">{session.adapterLabel ?? session.providerLabel}</span>
        </button>
        <WorkspacePathLabel path={session.workspacePath} className="mt-0.5 hidden px-1.5 sm:flex" focusable />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <span className="hidden max-w-36 border-r border-line pr-3 lg:block"><SessionAccountIdentity session={session} /></span>
        <span className="max-sm:hidden"><LinkedSessionsMenu session={session} /></span>
        <MergeButton session={session} merge={merge} disabled={closeBusy} />
        {deploy ? <DeployButton control={deploy} /> : null}
        <SessionActionsMenu session={session} deploy={deploy} onDetails={() => setDetailsOpen(true)}
          onClose={onClose} closeBusy={closeBusy} closeError={closeError} />
      </div>

      <SessionDetailsSheet open={detailsOpen} onClose={() => setDetailsOpen(false)} project={project} session={session} />
    </header>
  );
};
