import type { ReactNode } from 'react';
import { Terminal } from 'lucide-react';
import { OperationStateBadge } from '@/features/production/components/operation/OperationStateBadge';
import { useNow } from '@/features/production/hooks/useNow';
import { DeployTerminal } from '@/features/sessions/components/deploy/DeployTerminal';
import { TruncatedText } from '@/shared/components/data-display/TruncatedText';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { formatDuration } from '@/shared/utils/formatDuration';

interface OperationConsoleSnapshot {
  state: 'idle' | 'running' | 'succeeded' | 'failed';
  operationId: string | null;
  message: string | null;
  startedAt: string | null;
  updatedAt: string;
}

interface OperationConsoleProps {
  snapshot: OperationConsoleSnapshot | null;
  logs: string[];
  /** Accessible name of the log. */
  label: string;
  emptyTitle: string;
  emptyDescription: string;
  /** Shown in the terminal until the script prints its first line. */
  waitingMessage: string;
  /** What runs (release, commit, backup key), beside the outcome. */
  facts?: ReactNode;
  /** The next steps once it failed. */
  actions?: ReactNode;
}

/**
 * The live output of the project's current deployment or backup operation: its outcome and elapsed
 * time on a bar that never grows while lines stream, and a terminal that follows the tail until the
 * reader scrolls up (long lines scroll sideways inside it, never the page).
 */
export const OperationConsole = ({ snapshot, logs, label, emptyTitle, emptyDescription, waitingMessage, facts, actions }: OperationConsoleProps) => {
  const running = snapshot?.state === 'running';
  const now = useNow(running);

  if (!snapshot?.operationId || snapshot.state === 'idle') {
    return <div className="flex h-full items-center justify-center overflow-y-auto overscroll-contain p-gutter">
      <EmptyState icon={Terminal} title={emptyTitle} description={emptyDescription} bare />
    </div>;
  }

  const ended = running ? new Date(now).toISOString() : snapshot.updatedAt;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b border-line bg-surface px-gutter py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-footnote text-ink-muted">
          <OperationStateBadge state={snapshot.state} />
          {snapshot.startedAt ? <span className="font-medium text-ink tabular-nums">{formatDuration(snapshot.startedAt, ended)}</span> : null}
          {facts}
        </div>
        {snapshot.message ? <TruncatedText text={snapshot.message} lines={2} className="text-footnote text-ink-muted" /> : null}
        {snapshot.state === 'failed' && actions ? <div className="flex flex-wrap gap-2 [&>*]:max-sm:flex-1">{actions}</div> : null}
      </div>
      <DeployTerminal lines={logs} operationId={snapshot.operationId} label={label} emptyMessage={snapshot.message ?? waitingMessage} />
    </div>
  );
};
