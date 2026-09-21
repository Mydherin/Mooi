import { SessionListItem } from '@/features/sessions/components/SessionListItem';
import type { Session } from '@/features/sessions/types/Session';
import { Eyebrow } from '@/shared/components/Eyebrow';

interface SessionListProps {
  sessions: Session[];
}

export const SessionList = ({ sessions }: SessionListProps) => (
  <section>
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2.5">
      <Eyebrow>Sessions</Eyebrow>
      <span className="text-[11px] font-bold text-ink-subtle">{sessions.length}</span>
    </div>

    <ul className="flex flex-col">
      {sessions.map((session) => (
        <SessionListItem key={session.id} session={session} />
      ))}
    </ul>
  </section>
);
