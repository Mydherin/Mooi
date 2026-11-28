import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { projectPath } from '@/app/paths';
import { SessionListItem } from '@/features/sessions/components/SessionListItem';
import { sessionTree } from '@/features/sessions/lib/sessionTree';
import type { SessionGroup } from '@/features/sessions/types/SessionGroup';
import { Initials } from '@/shared/components/data-display/Initials';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import type { BackLink } from '@/shared/types/BackLink';

interface SessionGroupSectionProps {
  group: SessionGroup;
  /** Sessions opened from here lead back here. */
  backLink: BackLink;
}

/** One project's sessions under a heading that leads back to the project. */
export const SessionGroupSection = ({ group, backLink }: SessionGroupSectionProps) => (
  <section aria-label={group.projectName} className="flex min-w-0 flex-col gap-1.5">
    <div className="flex min-h-11 items-center justify-between gap-3 px-1">
      <Link to={projectPath(group.projectId)}
        className="group inline-flex min-h-11 min-w-0 items-center gap-2.5 rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <Initials value={group.projectName} size="sm" />
        <span className="truncate text-callout font-semibold text-ink">{group.projectName}</span>
        <ChevronRight aria-hidden className="size-3.5 shrink-0 text-ink-subtle transition hover-device:group-hover:translate-x-0.5 hover-device:group-hover:text-ink" />
      </Link>
      <span className="shrink-0 text-caption font-semibold text-ink-subtle tabular-nums">
        {group.sessions.length} {group.sessions.length === 1 ? 'session' : 'sessions'}
      </span>
    </div>
    <ListGroup>
      {sessionTree(group.sessions).map(({ session, depth }) => (
        <SessionListItem key={session.id} session={session} backLink={backLink} depth={depth} />
      ))}
    </ListGroup>
  </section>
);
