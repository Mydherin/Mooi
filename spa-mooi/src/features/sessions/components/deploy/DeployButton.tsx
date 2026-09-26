import { LoaderCircle, Rocket, Square } from 'lucide-react';
import { HeaderActionHint } from '@/features/sessions/components/HeaderActionHint';
import { useDeployment } from '@/features/sessions/hooks/useDeployment';
import { HEADER_ACTION_CLASS } from '@/features/sessions/lib/headerActionClass';
import type { Session } from '@/features/sessions/types/Session';
import { Button } from '@/shared/components/Button';
import { cn } from '@/shared/utils/cn';
import { useSessionsStore } from '@/stores/sessionsStore';
import { DeployLogsButton } from './DeployLogsButton';

/**
 * Deploy the session's root Docker Compose as a live preview, and stop it again. When that setup
 * is missing or fails, the backend hands it to the session's agent in a fresh conversation, like
 * merge conflicts; the failure hint says so, and the same control deploys again once it is done.
 * From the first deploy on, a logs control opens the Docker Compose output console.
 */
export const DeployButton = ({ session, disabled = false }: { session: Session; disabled?: boolean }) => {
  const { deployment, busy, error, start, stop } = useDeployment(session.id);
  const logOpen = useSessionsStore((store) => store.byId[session.id]?.deploymentLogOpen ?? false);
  const hasLog = useSessionsStore((store) => Boolean(store.byId[session.id]?.deploymentLog.length));
  if (!deployment) return null;
  const { state, cleanupRequired, result, phase } = deployment;
  const starting = state === 'starting';
  const stopping = state === 'stopping';
  const canStop = starting || state === 'running' || (state === 'failed' && cleanupRequired);
  const label = stopping ? 'Stopping…' : starting ? 'Deploying…' : canStop ? 'Stop' : state === 'failed' ? 'Retry' : 'Deploy';
  const blocked = disabled || busy || stopping || session.status === 'closed'
    || (!canStop && (session.status !== 'ready' || Boolean(session.pending)));
  const failure = error ?? result?.reason?.message ?? null;
  const hint = failure ?? (starting ? `${phase ?? 'Preparing the deployment'}\nClick to cancel.` : stopping ? phase : null);
  const withLogs = hasLog || Boolean(deployment.operationId);

  return (
    <div className="inline-flex min-w-0 shrink-0 items-stretch">
      <HeaderActionHint hint={hint}>
        <Button variant={canStop ? 'secondary' : 'brand'} size="sm" disabled={blocked}
          className={cn(HEADER_ACTION_CLASS, withLogs && 'rounded-r-none')}
          ariaLabel={starting ? 'Cancel deployment' : `${label} deployment`}
          onClick={() => void (canStop ? stop() : start())}>
          {busy || starting || stopping ? <LoaderCircle className="size-4 animate-spin" />
            : canStop ? <Square className="size-4" /> : <Rocket className="size-4" />}
          <span className="hidden sm:inline">{label}</span>
          {failure ? <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-danger-dot" /> : null}
        </Button>
      </HeaderActionHint>
      {withLogs ? <DeployLogsButton open={logOpen} active={starting}
        onClick={() => useSessionsStore.getState().setDeploymentLogOpen(session.id, !logOpen)} /> : null}
    </div>
  );
};
