import { Link } from 'react-router-dom';
import { ChevronRight, FileDiff } from 'lucide-react';
import { sessionPath } from '@/app/paths';
import { sessionStatusTone } from '@/features/sessions/lib/sessionStatusTone';
import type { Session } from '@/features/sessions/types/Session';
import { StatusDot } from '@/shared/components/StatusDot';

interface SessionListItemProps {
  session: Session;
}

export const SessionListItem = ({ session }: SessionListItemProps) => (
  <li>
    <Link
      to={sessionPath(session.projectId, session.id)}
      className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-5"
    >
      <StatusDot
        tone={sessionStatusTone(session.status)}
        pulse={session.status === 'working'}
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{session.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle">
          <span className="truncate font-mono">{session.branch}</span>
          <span>{session.provider}</span>
        </span>
      </span>

      <span className="hidden items-center gap-4 text-xs text-ink-subtle sm:flex">
        <span className="flex items-center gap-1.5">
          <FileDiff className="size-3.5" />
          {session.files}
        </span>
        <span>{session.updatedLabel}</span>
      </span>

      <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
    </Link>
  </li>
);
