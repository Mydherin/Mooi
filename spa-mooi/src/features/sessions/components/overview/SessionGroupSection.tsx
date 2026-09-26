import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { projectPath } from '@/app/paths';
import { SessionListItem } from '@/features/sessions/components/SessionListItem';
import type { SessionGroup } from '@/features/sessions/types/SessionGroup';
import { Initials } from '@/shared/components/Initials';

interface SessionGroupSectionProps {
  group: SessionGroup;
}

/** One project's sessions under a heading that leads back to the project. */
export const SessionGroupSection = ({ group }: SessionGroupSectionProps) => (
  <section aria-label={group.projectName}>
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2.5">
      <Link
        to={projectPath(group.projectId)}
        className="group inline-flex min-w-0 items-center gap-2.5 rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <Initials value={group.projectName} size="sm" />
        <span className="truncate text-sm font-extrabold text-ink">{group.projectName}</span>
        <ChevronRight className="size-3.5 shrink-0 text-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-ink" />
      </Link>
      <span className="shrink-0 text-[12px] font-bold text-ink-subtle">
        {group.sessions.length} {group.sessions.length === 1 ? 'session' : 'sessions'}
      </span>
    </div>

    <ul className="flex flex-col">
      {group.sessions.map((session) => (
        <SessionListItem key={session.id} session={session} />
      ))}
    </ul>
  </section>
);
