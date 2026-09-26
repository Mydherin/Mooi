import { BellRing, CircleCheck, Layers, LoaderCircle, Rocket } from 'lucide-react';
import { sessionDisplayStatus } from '@/features/sessions/lib/sessionDisplayStatus';
import type { Session } from '@/features/sessions/types/Session';
import type { SessionFilter } from '@/features/sessions/types/SessionFilter';

const displayOf = (session: Session) => sessionDisplayStatus(session.status, session.deployment.state);

/** A deployment counts whatever the agent is doing, so a preview never hides behind a busy agent. */
export const hasDeployment = (session: Session) =>
  session.deployment.state === 'starting' || session.deployment.state === 'running';

export const SESSION_FILTERS: SessionFilter[] = [
  { id: 'all', label: 'All', icon: Layers, matches: () => true },
  { id: 'working', label: 'Working', icon: LoaderCircle,
    matches: (session) => session.status === 'working' || session.status === 'provisioning' },
  { id: 'attention', label: 'Needs you', icon: BellRing,
    matches: (session) => session.status === 'waiting' || session.status === 'failed' },
  { id: 'ready', label: 'Ready', icon: CircleCheck, matches: (session) => displayOf(session) === 'ready' },
  { id: 'deployments', label: 'Deployments', icon: Rocket, matches: hasDeployment },
];

export const sessionFilter = (id: string | null): SessionFilter =>
  SESSION_FILTERS.find((filter) => filter.id === id) ?? SESSION_FILTERS[0];
