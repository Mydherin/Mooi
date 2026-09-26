import { sessionDisplayStatus } from '@/features/sessions/lib/sessionDisplayStatus';
import { sessionStatusLabel, sessionStatusPulses, sessionStatusTone } from '@/features/sessions/lib/sessionStatusTone';
import type { DeploymentState } from '@/features/sessions/types/DeploymentState';
import type { SessionStatus } from '@/features/sessions/types/SessionStatus';
import { StatusDot } from '@/shared/components/StatusDot';
import { toneStyles } from '@/shared/styles/toneStyles';
import { cn } from '@/shared/utils/cn';

interface SessionStatusBadgeProps {
  status: SessionStatus;
  deployment?: DeploymentState;
}

export const SessionStatusBadge = ({ status, deployment }: SessionStatusBadgeProps) => {
  const display = sessionDisplayStatus(status, deployment);
  const tone = sessionStatusTone(display);

  return (
    <span
      className={cn(
        'inline-flex w-full shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-extrabold',
        toneStyles(tone),
      )}
    >
      <StatusDot tone={tone} pulse={sessionStatusPulses(display)} />
      {sessionStatusLabel(display)}
    </span>
  );
};
