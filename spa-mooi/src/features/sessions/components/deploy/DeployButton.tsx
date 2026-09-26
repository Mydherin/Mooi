import { useSessionsStore } from '@/stores/sessionsStore';
import { LoaderCircle, Rocket, Square } from 'lucide-react';
import { HeaderActionHint } from '@/features/sessions/components/HeaderActionHint';
import { useDeployment } from '@/features/sessions/hooks/useDeployment';
import { HEADER_ACTION_CLASS } from '@/features/sessions/lib/headerActionClass';
import type { Session } from '@/features/sessions/types/Session';
import { Button } from '@/shared/components/Button';
import { DeployLogsButton } from './DeployLogsButton';
import { cn } from '@/shared/utils/cn';

export const DeployButton = ({ session, disabled = false }: { session: Session; disabled?: boolean }) => {
  const { deployment, progress, busy, error, start, stop } = useDeployment(session.id);
  const logsOpen = useSessionsStore((store) => store.byId[session.id]?.deploymentLogsOpen ?? false);
  const hasActivity = useSessionsStore((store) => Boolean(store.byId[session.id]?.deploymentActivity.length));
  if (!deployment) return null;
  const { state, cleanupRequired, result } = deployment;
  const canStop = state === 'starting' || state === 'running' || (state === 'failed' && cleanupRequired);
  const stopping = state === 'stopping';
  const starting = state === 'starting';
  const label = stopping ? 'Stopping…' : starting ? 'Deploying…' : canStop ? 'Stop' : state === 'failed' ? 'Retry' : 'Deploy';
  const blocked = disabled || busy || stopping || session.status === 'closed'
    || (!canStop && (session.status !== 'ready' || Boolean(session.pending)));
  const failure = error ?? result?.reason?.message ?? null;
  // Progress rides in the tooltip; the logs drawer holds the full story.
  const hint = failure
    ?? (starting ? `${progress?.message ?? 'Preparing your application…'}\nClick to cancel.` : null)
    ?? (stopping ? progress?.message ?? 'Stopping the application…' : null);
  const withLogs = Boolean(deployment.operationId) || hasActivity;

  return (
    <div className="inline-flex min-w-0 shrink-0 items-stretch">
      <HeaderActionHint hint={hint}>
        <Button variant={canStop ? 'secondary' : 'brand'} size="sm" disabled={blocked}
          className={cn(HEADER_ACTION_CLASS, withLogs && 'rounded-r-none')}
          ariaLabel={starting ? 'Stop deployment (cancel)' : `${label} deployment`}
          onClick={() => void (canStop ? stop() : start())}>
          {busy || stopping || starting ? <LoaderCircle className="size-4 animate-spin" />
            : canStop ? <Square className="size-4" /> : <Rocket className="size-4" />}
          <span className="hidden sm:inline">{label}</span>
          {failure ? <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-danger-dot" /> : null}
        </Button>
      </HeaderActionHint>
      {withLogs ? <DeployLogsButton open={logsOpen} active={starting || stopping}
        onClick={() => useSessionsStore.getState().toggleDeploymentLogs(session.id)} /> : null}
    </div>
  );
};
