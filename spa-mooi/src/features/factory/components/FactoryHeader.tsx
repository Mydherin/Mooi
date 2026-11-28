import { Bot, CircleAlert, MessagesSquare, Pause, Play, Square, Trash2 } from 'lucide-react';
import { countMilestones } from '@/features/factory/lib/countMilestones';
import { factoryNeedsAttention } from '@/features/factory/lib/factoryNeedsAttention';
import { FactoryStatusBadge } from '@/features/factory/components/FactoryStatusBadge';
import type { Factory } from '@/features/factory/types/Factory';
import { Button } from '@/shared/components/actions/Button';
import { Card } from '@/shared/components/data-display/Card';
import { Menu } from '@/shared/components/overlays/menu/Menu';
import { cn } from '@/shared/utils/cn';
import { Spinner } from '@/shared/components/feedback/Spinner';

interface FactoryHeaderProps {
  factory: Factory;
  /** Which control is waiting for its answer. */
  busy: 'pause' | 'stop' | null;
  actionError: string | null;
  onPause: (mode: 'graceful' | 'immediate') => void;
  onResume: () => void;
  onOpenChat: () => void;
  onRemove: () => void;
}

/** Status, why it stopped, the agent it runs with and overall progress, with the controls that apply now. */
export const FactoryHeader = ({ factory, busy, actionError, onPause, onResume, onOpenChat, onRemove }: FactoryHeaderProps) => {
  const { done, total } = countMilestones(factory.plan?.phases ?? []);
  const phases = factory.plan?.phases ?? [];
  const phasesDone = phases.filter((phase) => phase.status === 'done').length;
  const running = factory.status === 'running' || factory.status === 'pausing';
  const resumable = factory.status === 'paused';
  const attention = factoryNeedsAttention(factory);
  const run = factory.runConfig;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FactoryStatusBadge factory={factory} />
        <span className="text-footnote text-ink-muted tabular-nums">
          {phasesDone}/{phases.length} phases · {done}/{total} milestones
        </span>
        <span className="ml-auto flex items-center gap-2">
          {running ? <>
            <Button variant="secondary" size="sm" onClick={() => onPause('graceful')}
              disabled={busy !== null || factory.status === 'pausing'}>
              {busy === 'pause' ? <Spinner className="size-4" /> : <Pause className="size-4" />}
              {factory.status === 'pausing' ? 'Pausing…' : 'Pause'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onPause('immediate')} disabled={busy !== null}
              ariaLabel="Stop now: interrupt the session and save its work">
              {busy === 'stop' ? <Spinner className="size-4" /> : <Square className="size-3.5" />}
              <span className="max-sm:sr-only">Stop now</span>
            </Button>
          </> : null}
          {resumable ? <Button variant="brand" size="sm" onClick={onResume}><Play className="size-4" />Resume</Button> : null}
          <Button variant="ghost" size="sm" onClick={onOpenChat} ariaLabel="Open the factory chat">
            <MessagesSquare className="size-4" /><span className="max-sm:sr-only">Chat</span>
          </Button>
          <Menu label="Factory actions" sections={[
            { id: 'danger', items: [{ id: 'remove', label: 'Remove factory', icon: Trash2, destructive: true, disabled: running, onSelect: onRemove }] },
          ]} />
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={percent} aria-label="Milestones done">
        <div className="h-full rounded-full bg-brand-gradient transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>

      {factory.attention ? (
        <p className={cn('flex gap-2 rounded-control px-3.5 py-2.5 text-footnote leading-relaxed',
          attention ? 'border border-warning/30 bg-warning-soft text-ink' : 'bg-surface-2 text-ink-muted')}>
          <CircleAlert className={cn('mt-0.5 size-4 shrink-0', attention ? 'text-warning' : 'text-ink-subtle')} />
          <span className="min-w-0 break-words">{factory.attention}</span>
        </p>
      ) : null}

      {run ? (
        <p className="flex min-w-0 items-center gap-1.5 text-caption text-ink-subtle">
          <Bot className="size-3.5 shrink-0" />
          <span className="truncate">
            {[run.provider, run.adapter, run.model, run.effort].filter(Boolean).join(' · ')}
          </span>
        </p>
      ) : null}
      {actionError ? <p role="alert" className="rounded-control border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-footnote text-danger">{actionError}</p> : null}
    </Card>
  );
};
