import { Link } from 'react-router-dom';
import { Coffee, Gauge, SquareArrowOutUpRight } from 'lucide-react';
import { sessionPath } from '@/app/paths';
import { FACTORY_CONTEXT_LIMIT } from '@/features/factory/lib/factoryContextLimit';
import { factoryRoleLabel } from '@/features/factory/lib/factoryRoleLabel';
import { factoryStepTarget } from '@/features/factory/lib/factoryStepTarget';
import type { Factory } from '@/features/factory/types/Factory';
import { Card } from '@/shared/components/data-display/Card';
import { Eyebrow } from '@/shared/components/data-display/Eyebrow';
import { StatusDot } from '@/shared/components/data-display/StatusDot';
import { buttonStyles } from '@/shared/styles/buttonStyles';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';
import { cn } from '@/shared/utils/cn';
import { useSessionsStore } from '@/stores/sessionsStore';

/**
 * The step running now: its role and target, its session's context against the handover limit, and
 * a link to the session itself (chat, changes, trace), which the user may also write in.
 */
export const FactoryActiveStep = ({ factory }: { factory: Factory }) => {
  const step = factory.activeStep;
  const session = useSessionsStore((state) => (step?.sessionId ? state.sessions.find((item) => item.id === step.sessionId) : undefined));

  if (!step) {
    return (
      <Card as="section" className="flex flex-col p-4 sm:p-5">
        <Eyebrow>Active step</Eyebrow>
        <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-subtle">
          <Coffee className="size-4" />
          {factory.status === 'running' ? 'Between steps: reading the plan.' : 'No session is working right now.'}
        </p>
      </Card>
    );
  }

  const percent = session?.usage?.context?.percent ?? step.peakContextPercent ?? null;
  // The gauge spans the handover limit: full means the session is about to hand over.
  const fill = percent === null ? 0 : Math.min(100, (percent / FACTORY_CONTEXT_LIMIT) * 100);
  const near = percent !== null && percent >= FACTORY_CONTEXT_LIMIT * 0.8;
  // A run that lost its sign-in leaves its step open with the work until the next resume reconciles it.
  const live = factory.status === 'running' || factory.status === 'pausing';

  return (
    <Card as="section" className="flex flex-col gap-3.5 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Eyebrow className="flex-1">{live ? 'Active step' : 'Step on hold'}</Eyebrow>
        <StatusDot tone={live ? 'success' : 'neutral'} pulse={live} />
        <span className="text-[11.5px] text-ink-subtle">
          {live ? `started ${formatRelativeTime(step.startedAt)}` : 'resumes with the factory'}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-ink">{factoryRoleLabel(step.role)}</p>
        <p className="mt-0.5 truncate font-mono text-[12px] text-ink-muted">{factoryStepTarget(step)}</p>
        {step.branch ? <p className="mt-0.5 truncate font-mono text-[11px] text-ink-subtle">{step.branch}</p> : null}
      </div>
      <div>
        <div className="flex items-center justify-between gap-2 text-[11.5px] text-ink-subtle">
          <span className="flex items-center gap-1.5"><Gauge className="size-3.5" />Context</span>
          <span className="tabular-nums">{percent === null ? '—' : `${Math.round(percent)}%`} / {FACTORY_CONTEXT_LIMIT}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className={cn('h-full rounded-full transition-[width] duration-500', near ? 'bg-warning-dot' : 'bg-brand-gradient')}
            style={{ width: `${fill}%` }} />
        </div>
      </div>
      {step.sessionId ? (
        <Link to={sessionPath(factory.projectId, step.sessionId)} className={buttonStyles('secondary', 'sm', 'self-start')}>
          <SquareArrowOutUpRight className="size-3.5" />Open session
        </Link>
      ) : null}
    </Card>
  );
};
