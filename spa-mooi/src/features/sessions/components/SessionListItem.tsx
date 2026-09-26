import { Link } from 'react-router-dom';
import { ChevronRight, GitBranch } from 'lucide-react';
import { sessionPath } from '@/app/paths';
import { SessionStatusBadge } from '@/features/sessions/components/SessionStatusBadge';
import { WorkspacePathLabel } from '@/features/sessions/components/WorkspacePathLabel';
import type { Session } from '@/features/sessions/types/Session';
import { formatDate } from '@/shared/utils/formatDate';

interface SessionListItemProps {
  session: Session;
}

export const SessionListItem = ({ session }: SessionListItemProps) => (
  <li className="border-b border-line last:border-b-0">
    <Link
      to={sessionPath(session.projectId, session.id)}
      className="flex items-center gap-3 px-1 py-3.5 transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:gap-4 sm:px-2.5"
    >
      <span className="w-[108px] shrink-0">
        <SessionStatusBadge status={session.status} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-extrabold text-ink">
          <GitBranch className="size-3.5 shrink-0 text-ink-subtle" />
          <span className="truncate font-mono">{session.branch}</span>
        </p>
        <p className="mt-0.5 truncate text-[11px] text-ink-subtle">
          {session.detail ?? `Updated ${formatDate(session.updatedAt)}`}
        </p>
        <WorkspacePathLabel path={session.workspacePath} className="mt-1" />
      </div>

      <span className="hidden shrink-0 text-[11px] font-bold text-ink-subtle sm:block">{session.providerLabel}</span>

      <ChevronRight className="size-4 shrink-0 text-line-strong" />
    </Link>
  </li>
);
