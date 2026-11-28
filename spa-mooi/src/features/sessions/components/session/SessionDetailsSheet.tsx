import { Bot, Clock, Cpu, FolderGit2, GitBranch, GitFork, Layers, Target } from 'lucide-react';
import { projectPath, sessionPath } from '@/app/paths';
import type { Project } from '@/features/projects/types/Project';
import { SessionAccountIdentity } from '@/features/sessions/components/SessionAccountIdentity';
import { SessionLiveStatus } from '@/features/sessions/components/SessionLiveStatus';
import { SessionUsageMeters } from '@/features/sessions/components/SessionUsageMeters';
import { SessionDetailRow } from '@/features/sessions/components/session/SessionDetailRow';
import { useLinkedSessions } from '@/features/sessions/hooks/useLinkedSessions';
import type { Session } from '@/features/sessions/types/Session';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { ListRow } from '@/shared/components/data-display/ListRow';
import { Sheet } from '@/shared/components/overlays/sheet/Sheet';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';

interface SessionDetailsSheetProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  session: Session;
}

const LinkedSessionsGroup = ({ session }: { session: Session }) => {
  const { origin, opened } = useLinkedSessions(session);
  if (!session.origin && opened.length === 0) return null;

  return (
    <ListGroup title="Linked sessions">
      {session.origin ? (
        <ListRow title={origin?.title || session.origin.branch} subtitle={`Opened this session${origin?.title ? ` · ${session.origin.branch}` : ''}`}
          leading={<GitFork aria-hidden className="size-4.5 text-ink-subtle" />}
          to={origin ? sessionPath(origin.projectId, origin.id) : undefined} trailing={<SessionLiveStatus session={origin} />} />
      ) : null}
      {opened.map((child) => (
        <ListRow key={child.id} title={child.title || child.branch} subtitle={child.title ? child.branch : 'Opened by this session'}
          leading={<GitBranch aria-hidden className="size-4.5 text-ink-subtle" />}
          to={sessionPath(child.projectId, child.id)} trailing={<SessionLiveStatus session={child} />} />
      ))}
    </ListGroup>
  );
};

/**
 * Everything that identifies a session, readable in full and copyable: the header only has room for
 * the branch, so a tap on it opens this sheet (and the actions menu offers the same entry).
 */
export const SessionDetailsSheet = ({ open, onClose, project, session }: SessionDetailsSheetProps) => (
  <Sheet open={open} onClose={onClose} title="Session details" description={project.fullName} detents={['medium', 'large']} size="md">
    <div className="flex flex-col gap-5">
      <ListGroup title="Usage">
        <li className="bg-surface px-4 py-3"><SessionUsageMeters session={session} /></li>
      </ListGroup>

      <ListGroup title="Session">
        <SessionDetailRow icon={GitBranch} label="Branch" mono copy={session.branch}>{session.branch}</SessionDetailRow>
        {session.title ? <SessionDetailRow icon={Target} label="Task">{session.title}</SessionDetailRow> : null}
        <SessionDetailRow icon={GitBranch} label="Created from" mono>{session.baseBranch || '—'}</SessionDetailRow>
        <SessionDetailRow icon={FolderGit2} label="Clone path" mono copy={session.workspacePath ?? undefined}>
          {session.workspacePath ?? <span className="font-sans text-ink-subtle italic">Clone not ready yet</span>}
        </SessionDetailRow>
        <SessionDetailRow icon={Clock} label="Updated">{formatRelativeTime(session.updatedAt)}</SessionDetailRow>
      </ListGroup>

      <ListGroup title="Agent">
        <SessionDetailRow icon={Bot} label="Account"><SessionAccountIdentity session={session} compact /></SessionDetailRow>
        <SessionDetailRow icon={Cpu} label="Model" mono>{session.model}{session.effort ? ` · ${session.effort}` : ''}</SessionDetailRow>
      </ListGroup>

      <LinkedSessionsGroup session={session} />

      <ListGroup>
        <ListRow title={project.name} subtitle="Open the project" leading={<Layers aria-hidden className="size-4.5 text-ink-subtle" />}
          to={projectPath(project.id)} />
      </ListGroup>
    </div>
  </Sheet>
);
