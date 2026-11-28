import { FlaskConical } from 'lucide-react';
import { milestoneStatusLabel } from '@/features/factory/lib/milestoneStatusLabel';
import { milestoneTone } from '@/features/factory/lib/milestoneTone';
import type { FactoryMilestone } from '@/features/factory/types/FactoryMilestone';
import { Badge } from '@/shared/components/data-display/Badge';
import { StatusDot } from '@/shared/components/data-display/StatusDot';
import { cn } from '@/shared/utils/cn';

/** One milestone: its status, failed test cycles, and a pulse while a session works on it. */
export const FactoryMilestoneRow = ({ milestone, active }: { milestone: FactoryMilestone; active: boolean }) => {
  const tone = milestoneTone(milestone);
  return (
    <li className={cn('flex min-w-0 items-center gap-2.5 rounded-chip px-2 py-2', active && 'bg-brand-soft/60')}>
      <StatusDot tone={tone} pulse={active} />
      <span className="shrink-0 font-mono text-[10.5px] text-ink-subtle">{milestone.id.slice(0, 2)}</span>
      <span className={cn('min-w-0 flex-1 truncate text-[13px]', milestone.status === 'done' ? 'text-ink-muted' : 'text-ink')}>
        {milestone.title}
      </span>
      {milestone.attempts > 0 ? (
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-warning tabular-nums" title={`${milestone.attempts} failed test cycles`}>
          <FlaskConical className="size-3" />{milestone.attempts}
        </span>
      ) : null}
      <Badge tone={tone} className="shrink-0">{milestoneStatusLabel(milestone)}</Badge>
    </li>
  );
};
