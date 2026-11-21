import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, LoaderCircle } from 'lucide-react';
import { sessionPath } from '@/app/paths';
import { factoryRoleLabel } from '@/features/factory/lib/factoryRoleLabel';
import { factoryStepTarget } from '@/features/factory/lib/factoryStepTarget';
import { useFactorySteps } from '@/features/factory/hooks/useFactorySteps';
import type { FactoryStep } from '@/features/factory/types/FactoryStep';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { Eyebrow } from '@/shared/components/Eyebrow';
import type { Tone } from '@/shared/types/Tone';
import { formatDuration } from '@/shared/utils/formatDuration';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';
import { shortCommit } from '@/shared/utils/shortCommit';

const TONES: Record<FactoryStep['status'], Tone> = {
  running: 'brand', completed: 'success', continue: 'info', failed: 'warning', blocked: 'danger', interrupted: 'neutral',
};
const LABELS: Record<FactoryStep['status'], string> = {
  running: 'Running', completed: 'Completed', continue: 'Handed over', failed: 'Test failed', blocked: 'Blocked', interrupted: 'Interrupted',
};

interface FactoryJournalProps {
  projectId: string;
  /** Changes on every factory write, so the newest page follows the loop live. */
  revision: string;
  live: boolean;
}

/** Every step of the loop, newest first: role, target, outcome, context peak and the commits it left. */
export const FactoryJournal = ({ projectId, revision, live }: FactoryJournalProps) => {
  const { steps, hasMore, loading, error, loadMore } = useFactorySteps(projectId, revision);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card as="section" className="flex flex-col p-4 sm:p-5">
      <Eyebrow>Journal</Eyebrow>
      {error ? <p role="alert" className="mt-3 text-[12.5px] text-danger">{error}</p> : null}
      {steps.length === 0 && !loading ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-subtle"><ListChecks className="size-4" />No steps yet.</p>
      ) : null}
      <ol className="mt-2 flex flex-col divide-y divide-line">
        {steps.map((step) => {
          const open = expanded === step.id;
          return (
            <li key={step.id} className="py-2.5">
              <button type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : step.id)}
                className="flex w-full min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 rounded-chip text-left focus-visible:outline-2 focus-visible:outline-brand">
                <span className="text-[13px] font-semibold text-ink">{factoryRoleLabel(step.role)}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-muted">{factoryStepTarget(step)}</span>
                <Badge tone={TONES[step.status]}>{LABELS[step.status]}</Badge>
                <span className="w-full text-[11.5px] text-ink-subtle tabular-nums sm:w-auto">
                  {formatRelativeTime(step.startedAt)}
                  {step.finishedAt ? ` · ${formatDuration(step.startedAt, step.finishedAt)}` : ''}
                  {step.peakContextPercent !== null ? ` · ${step.peakContextPercent}% context` : ''}
                </span>
              </button>
              {open ? (
                <div className="mt-2 flex flex-col gap-2 rounded-control bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-muted">
                  {step.summary ? <p className="break-words whitespace-pre-wrap">{step.summary}</p> : <p className="text-ink-subtle">No summary.</p>}
                  <p className="font-mono text-[11px] text-ink-subtle">
                    {step.branch ?? '—'} · {shortCommit(step.baseCommit)} → {shortCommit(step.headCommit)}{step.model ? ` · ${step.model}` : ''}
                  </p>
                  {step.sessionId && step.status === 'running' && live ? (
                    <Link to={sessionPath(projectId, step.sessionId)} className="self-start text-[12px] font-semibold text-brand hover:underline">Open session</Link>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {hasMore || loading ? (
        <Button variant="ghost" size="sm" className="mt-2 self-center" onClick={loadMore} disabled={loading}>
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {loading ? 'Loading…' : 'Show older steps'}
        </Button>
      ) : null}
    </Card>
  );
};
