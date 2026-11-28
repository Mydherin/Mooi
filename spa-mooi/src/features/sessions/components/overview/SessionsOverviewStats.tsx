import { BellRing, LoaderCircle, MessagesSquare, Rocket } from 'lucide-react';
import { Stat } from '@/shared/components/data-display/Stat';
import { sessionFilter } from '@/features/sessions/lib/sessionFilters';
import type { Session } from '@/features/sessions/types/Session';
import type { SessionFilterId } from '@/features/sessions/types/SessionFilterId';

interface SessionsOverviewStatsProps {
  sessions: Session[];
}

const count = (sessions: Session[], filterId: SessionFilterId) =>
  sessions.filter(sessionFilter(filterId).matches).length;

export const SessionsOverviewStats = ({ sessions }: SessionsOverviewStatsProps) => {
  const projects = new Set(sessions.map((session) => session.projectId)).size;
  const deploying = sessions.filter((session) => session.deployment.state === 'starting').length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={MessagesSquare} label="Live" value={String(sessions.length)}
        hint={`${projects} ${projects === 1 ? 'project' : 'projects'}`} />
      <Stat icon={LoaderCircle} label="Working" value={String(count(sessions, 'working'))} hint="Agents on a turn" />
      <Stat icon={BellRing} label="Needs you" value={String(count(sessions, 'attention'))} hint="Questions or failures" />
      <Stat icon={Rocket} label="Previews" value={String(count(sessions, 'deployments'))}
        hint={deploying ? `${deploying} deploying` : 'Previews running'} />
    </div>
  );
};
