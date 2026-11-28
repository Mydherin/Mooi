import { Plus } from 'lucide-react';
import { SessionListItem } from '@/features/sessions/components/SessionListItem';
import { sessionTree } from '@/features/sessions/lib/sessionTree';
import type { Session } from '@/features/sessions/types/Session';
import { Button } from '@/shared/components/actions/Button';

interface SessionListProps {
  sessions: Session[];
  onNewSession: () => void;
}

/** The project's live sessions, with the action that adds one sitting right where they appear. */
export const SessionList = ({ sessions, onNewSession }: SessionListProps) => (
  <section>
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2.5">
      <p className="text-[12px] font-bold text-ink-subtle">
        {sessions.length} live {sessions.length === 1 ? 'session' : 'sessions'}
      </p>
      <Button variant="brand" size="sm" onClick={onNewSession}>
        <Plus className="size-4" />
        New session
      </Button>
    </div>

    <ul className="flex flex-col">
      {sessionTree(sessions).map(({ session, depth }) => (
        <SessionListItem key={session.id} session={session} depth={depth} />
      ))}
    </ul>
  </section>
);
