import { useAccountFiveHourLimit } from '@/features/sessions/hooks/useAccountFiveHourLimit';
import { usagePercent } from '@/features/sessions/lib/usagePercent';
import { cn } from '@/shared/utils/cn';

interface AgentAccountLimitProps {
  connectionId: string;
}

/** The account's latest 5 hour usage, as its sessions last read it; nothing until one did. */
export const AgentAccountLimit = ({ connectionId }: AgentAccountLimitProps) => {
  const percent = usagePercent(useAccountFiveHourLimit(connectionId));
  if (percent === null) return null;
  const rounded = Math.round(percent);

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      ·
      <span aria-hidden className="relative h-1.5 w-10 overflow-hidden rounded-full bg-surface-3">
        <span className={cn('absolute inset-y-0 left-0 rounded-full', rounded >= 90 ? 'bg-danger-dot' : rounded >= 70 ? 'bg-warning-dot' : 'bg-success-dot')}
          style={{ width: `${rounded}%` }} />
      </span>
      <span className="tabular-nums">5 h {rounded}%</span>
    </span>
  );
};
