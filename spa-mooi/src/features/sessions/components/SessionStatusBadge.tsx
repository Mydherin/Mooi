import { sessionStatusLabel, sessionStatusPulses, sessionStatusTone } from '@/features/sessions/lib/sessionStatusTone';
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
      'inline-flex w-full shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-extrabold',
      toneStyles(sessionStatusTone(status)),
    )}
  >
    <StatusDot tone={sessionStatusTone(status)} pulse={sessionStatusPulses(status)} />
    {sessionStatusLabel(status)}
  </span>
);
