import { sessionDisplayStatus } from '@/features/sessions/lib/sessionDisplayStatus';
import { sessionStatusLabel, sessionStatusPulses, sessionStatusTone } from '@/features/sessions/lib/sessionStatusTone';
import type { Session } from '@/features/sessions/types/Session';
import { StatusDot } from '@/shared/components/StatusDot';
import { cn } from '@/shared/utils/cn';

interface SessionLiveStatusProps {
  /** Undefined once the session is gone: it reads as closed. */
  session: Session | undefined;
  className?: string;
}

/** The inline form of `SessionStatusBadge`: a live dot and its label, for rows and cards that link a session. */
export const SessionLiveStatus = ({ session, className }: SessionLiveStatusProps) => {
  const display = session ? sessionDisplayStatus(session.status, session.deployment.state) : 'closed';

  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold whitespace-nowrap text-ink-muted', className)}>
      <StatusDot tone={sessionStatusTone(display)} pulse={sessionStatusPulses(display)} />
      {sessionStatusLabel(display)}
    </span>
  );
};
