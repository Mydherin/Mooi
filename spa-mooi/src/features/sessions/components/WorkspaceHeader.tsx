import { Link } from 'react-router-dom';
import { ChevronLeft, GitBranch } from 'lucide-react';
import { projectPath } from '@/app/paths';
import type { Project } from '@/features/projects/types/Project';
import type { Session } from '@/features/sessions/types/Session';

interface WorkspaceHeaderProps {
  project: Project;
  session: Session;
  onClose: () => void;
  closeBusy: boolean;
}

export const WorkspaceHeader = ({
  project,
  session,
  onClose,
  closeBusy,
}: WorkspaceHeaderProps) => (
  <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 py-2 sm:gap-3 sm:px-5">
    <Link
      to={projectPath(project.id)}
      aria-label="Back to project"
      className="flex size-10 shrink-0 items-center justify-center rounded-[10px] text-ink-muted transition hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <ChevronLeft className="size-4" />
    </Link>

    <h1 className="min-w-0 flex-1 truncate text-[17px] font-extrabold tracking-[-0.03em] text-ink sm:text-lg">
      {session.title}
    </h1>

    <span className="hidden min-w-0 max-w-[15rem] items-center gap-1.5 rounded-[10px] border border-line px-2.5 py-1.5 font-mono text-[11px] text-ink-muted sm:inline-flex">
      <GitBranch className="size-3 shrink-0" />
      <span className="truncate">{session.branch}</span>
    </span>

    <button
      type="button"
      onClick={onClose}
      disabled={closeBusy}
      className="shrink-0 rounded-[10px] px-2 py-2 text-xs font-bold text-danger transition hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 sm:px-2.5 sm:text-[13px]"
    >
      Close
    </button>
  </div>
);
