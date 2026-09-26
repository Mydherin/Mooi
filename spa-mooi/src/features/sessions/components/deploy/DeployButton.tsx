import { useSessionsStore } from '@/stores/sessionsStore';
import { LoaderCircle, Rocket, Square } from 'lucide-react';
import { useDeployment } from '@/features/sessions/hooks/useDeployment';
import type { Session } from '@/features/sessions/types/Session';
import { Button } from '@/shared/components/Button';
import { DeployLogsButton } from './DeployLogsButton';
import { cn } from '@/shared/utils/cn';

export const DeployButton = ({ session, disabled = false }: { session: Session; disabled?: boolean }) => {
  const { deployment, progress, busy, error, start, stop } = useDeployment(session.id);
  if (!deployment) return null;
  const { state, cleanupRequired, result } = deployment;
  const canStop = state === 'starting' || state === 'running' || (state === 'failed' && cleanupRequired);
  const stopping = state === 'stopping';
  const label = stopping ? 'Stopping…' : state === 'starting' ? 'Deploying…' : canStop ? 'Stop' : state === 'failed' ? 'Retry' : 'Deploy';
  const blocked = disabled || busy || stopping || session.status === 'closed'
    || (!canStop && (session.status !== 'ready' || Boolean(session.pending)));
  const message = error ?? result?.reason?.message;
  const logsOpen = useSessionsStore((store) => store.byId[session.id]?.deploymentLogsOpen ?? false);
  const hasActivity = useSessionsStore((store) => Boolean(store.byId[session.id]?.deploymentActivity.length));

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <div className="inline-flex min-w-0 items-stretch">
      <Button variant={canStop ? 'secondary' : 'brand'} size="sm" disabled={blocked}
        className={cn('relative w-10 px-0 sm:w-auto sm:px-3.5', (deployment.operationId || hasActivity) && 'rounded-r-none')}
        ariaLabel={state === 'starting' ? 'Stop deployment (cancel)' : `${label} deployment`}
        onClick={() => void (canStop ? stop() : start())}>
        {busy || stopping || state === 'starting' ? <LoaderCircle className="size-4 animate-spin" />
          : canStop ? <Square className="size-4" /> : <Rocket className="size-4" />}
        {/* Icon-only on phones so the header keeps room for Close; the logs toggle shows progress. */}
        <span className="hidden sm:inline">{label}</span>
        {state === 'starting' ? <span className="hidden text-xs sm:inline">· Stop</span> : null}
        {message ? <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-danger-dot sm:hidden" /> : null}
      </Button>
      {deployment.operationId || hasActivity ? <DeployLogsButton open={logsOpen} active={state === 'starting' || state === 'stopping'}
        onClick={() => useSessionsStore.getState().toggleDeploymentLogs(session.id)} /> : null}
      </div>
      <div className="sr-only basis-full text-right text-xs [overflow-wrap:anywhere] sm:not-sr-only" aria-live="polite" aria-atomic="true">
        {message ? <p className="text-danger">{message}</p>
          : progress ? <p className="text-ink-muted">{progress.message}</p>
          : state === 'starting' ? <p className="text-ink-muted">Preparing your application…</p>
          : stopping ? <p className="text-ink-muted">Stopping the application…</p> : null}
      </div>
    </div>
  );
};
