import { sessionStatusLabel, sessionStatusTone } from '@/features/sessions/lib/sessionStatusTone';
import type { SessionStatus } from '@/features/sessions/types/SessionStatus';
import { StatusDot } from '@/shared/components/StatusDot';
import { toneStyles } from '@/shared/styles/toneStyles';
import { cn } from '@/shared/utils/cn';

interface SessionStatusBadgeProps {
  status: SessionStatus;
}

export const SessionStatusBadge = ({ status }: SessionStatusBadgeProps) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium',
      toneStyles(sessionStatusTone(status)),
    )}
  >
    <StatusDot tone={sessionStatusTone(status)} pulse={status === 'working'} />
    {sessionStatusLabel(status)}
  </span>
);
