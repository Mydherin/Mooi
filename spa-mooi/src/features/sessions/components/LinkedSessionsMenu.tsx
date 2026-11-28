import { GitBranch, GitBranchPlus } from 'lucide-react';
import { sessionPath } from '@/app/paths';
import { SessionLiveStatus } from '@/features/sessions/components/SessionLiveStatus';
import { useLinkedSessions } from '@/features/sessions/hooks/useLinkedSessions';
import type { Session } from '@/features/sessions/types/Session';
import type { MenuItem } from '@/shared/components/overlays/menu/MenuItem';
import { Menu } from '@/shared/components/overlays/menu/Menu';

interface LinkedSessionsMenuProps {
  session: Session;
}

const linkedItem = (session: Session): MenuItem => ({
  id: session.id,
  label: session.title || session.branch,
  description: session.title ? session.branch : undefined,
  icon: GitBranch,
  to: sessionPath(session.projectId, session.id),
  trailing: <SessionLiveStatus session={session} />,
});

/**
 * A session's lineage, one tap from its header: the session whose agent opened it and the ones its
 * own agent opened, each with its live state. Only sessions with a lineage show it.
 */
export const LinkedSessionsMenu = ({ session }: LinkedSessionsMenuProps) => {
  const { origin, opened } = useLinkedSessions(session);
  if (!session.origin && opened.length === 0) return null;
  const count = opened.length + (session.origin ? 1 : 0);
  const originItem: MenuItem | null = session.origin
    ? origin ? linkedItem(origin) : { id: 'origin', label: session.origin.branch, icon: GitBranch, disabled: true, trailing: <SessionLiveStatus session={undefined} /> }
    : null;

  return (
    <Menu label={`Linked sessions (${count})`} icon={GitBranchPlus} count={count} width="lg" sections={[
      { id: 'origin', title: 'Opened from', items: originItem ? [originItem] : [] },
      { id: 'opened', title: 'Opened by this session', items: opened.map(linkedItem) },
    ]} />
  );
};
