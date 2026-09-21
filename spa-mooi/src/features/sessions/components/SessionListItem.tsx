import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { sessionPath } from '@/app/paths';
import { SessionStatusBadge } from '@/features/sessions/components/SessionStatusBadge';
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
        <p className="truncate text-sm font-extrabold text-ink">{session.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-ink-subtle">
          {session.detail ?? `Updated ${formatDate(session.updatedAt)}`}
        </p>
      </div>

      <span className="hidden shrink-0 items-center gap-3 text-[11px] text-ink-subtle sm:flex">
        <span className="max-w-[180px] truncate font-mono">{session.branch}</span>
        <span className="font-bold">{session.providerLabel}</span>
      </span>

      <ChevronRight className="size-4 shrink-0 text-line-strong" />
    </Link>
  </li>
);
