import { SessionListItem } from '@/features/sessions/components/SessionListItem';
import { sessionTree } from '@/features/sessions/lib/sessionTree';
import type { Session } from '@/features/sessions/types/Session';
import { ListGroup } from '@/shared/components/data-display/ListGroup';

interface SessionListProps {
  sessions: Session[];
}

/** The project's live sessions, each nested under the session whose agent opened it. */
export const SessionList = ({ sessions }: SessionListProps) => (
  <ListGroup>
    {sessionTree(sessions).map(({ session, depth }) => (
      <SessionListItem key={session.id} session={session} depth={depth} />
    ))}
  </ListGroup>
);
