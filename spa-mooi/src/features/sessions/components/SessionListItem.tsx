import { Link } from 'react-router-dom';
import { ChevronRight, CornerDownRight, Factory, GitBranch } from 'lucide-react';
import { sessionPath } from '@/app/paths';
import { factoryRoleLabel } from '@/features/factory/lib/factoryRoleLabel';
import { Badge } from '@/shared/components/data-display/Badge';
import { SessionStatusBadge } from '@/features/sessions/components/SessionStatusBadge';
import { SessionAccountIdentity } from '@/features/sessions/components/SessionAccountIdentity';
import { SessionUsageMeters } from '@/features/sessions/components/SessionUsageMeters';
import { WorkspacePathLabel } from '@/features/sessions/components/WorkspacePathLabel';
import type { Session } from '@/features/sessions/types/Session';
import type { BackLink } from '@/shared/types/BackLink';
import { backLinkState } from '@/shared/utils/backLinkState';
import { formatDate } from '@/shared/utils/formatDate';

interface SessionListItemProps {
  session: Session;
  /** Where the session's back button returns; its project by default. */
  backLink?: BackLink;
  /** Levels below the listed session whose agent opened it (see `sessionTree`); 0 on its own. */
  depth?: number;
}

/** Deeper lineages keep the indentation of this level, so a long chain never squeezes the row. */
const MAX_INDENT = 3;
const INDENT_REM = 1.25;

export const SessionListItem = ({ session, backLink, depth = 0 }: SessionListItemProps) => {
  const indent = Math.min(depth, MAX_INDENT) * INDENT_REM;

  return (
    <li className="relative min-w-0 bg-surface">
      {depth > 0 ? (
        <span aria-hidden className="pointer-events-none absolute -top-px bottom-1/2 w-3 rounded-bl-lg border-b border-l border-brand/30"
          style={{ left: `${indent + 0.25}rem` }} />
      ) : null}
      <Link
        to={sessionPath(session.projectId, session.id)}
        state={backLink ? backLinkState(backLink) : undefined}
        style={depth > 0 ? { paddingLeft: `${indent + 1.5}rem` } : undefined}
        className="flex min-h-16 items-center gap-3 py-3 pr-3 pl-4 outline-none active:bg-surface-2 focus-visible:bg-surface-2 hover-device:hover:bg-surface-2/60 sm:gap-4"
      >
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 text-callout font-semibold text-ink">
            <GitBranch aria-hidden className="size-3.5 shrink-0 text-ink-subtle" />
            <span className="min-w-0 truncate font-mono">{session.branch}</span>
            {session.factory ? <Badge tone="brand" icon={Factory} className="shrink-0">{factoryRoleLabel(session.factory.role)}</Badge> : null}
            <span className="ml-auto shrink-0 pl-1"><SessionStatusBadge status={session.status} deployment={session.deployment.state} /></span>
          </p>
          {session.title ? <p className="mt-0.5 truncate text-footnote font-medium text-ink-muted">{session.title}</p> : null}
          {session.origin ? (
            <p className={depth > 0 ? 'sr-only' : 'mt-0.5 flex min-w-0 items-center gap-1 text-caption font-semibold text-brand'}>
              <CornerDownRight aria-hidden className="size-3 shrink-0" />
              <span className="truncate">Opened from <span className="font-mono">{session.origin.branch}</span></span>
            </p>
          ) : null}
          <p className="mt-0.5 truncate text-caption text-ink-subtle">
            {session.detail ?? `Updated ${formatDate(session.updatedAt)}`}
          </p>
          <span className="mt-0.5 block sm:hidden"><SessionAccountIdentity session={session} compact /></span>
          <WorkspacePathLabel path={session.workspacePath} className="mt-1" />
          <SessionUsageMeters session={session} className="mt-2 max-w-60 sm:hidden" />
        </div>

        <SessionUsageMeters session={session} className="hidden w-36 shrink-0 sm:grid" />

        <span className="hidden min-w-0 max-w-32 shrink-0 sm:block"><SessionAccountIdentity session={session} /></span>

        <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-subtle" />
      </Link>
    </li>
  );
};
