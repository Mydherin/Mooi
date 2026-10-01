import { useState } from 'react';
import { LoaderCircle, Rocket, Settings2, Square, SquareTerminal } from 'lucide-react';
import { HeaderActionHint } from '@/features/sessions/components/HeaderActionHint';
import { useDeployment } from '@/features/sessions/hooks/useDeployment';
import { deploymentConsoleHidden } from '@/features/sessions/lib/deploymentConsoleHidden';
import { HEADER_ACTION_CLASS } from '@/features/sessions/lib/headerActionClass';
import type { Session } from '@/features/sessions/types/Session';
import { Button } from '@/shared/components/Button';
import { cn } from '@/shared/utils/cn';
import { useSessionsStore } from '@/stores/sessionsStore';
import { DeployGroupButton } from './DeployGroupButton';
import { DeploymentSetupDialog } from './DeploymentSetupDialog';

/**
 * Deploy the session's root Docker Compose as a live preview, and stop it again. Without a setup
 * (no root Compose file, or a failed start), Deploy clears the chat and the agent sets the deployment
 * up there, ending with a test run; the console stays hidden while it prepares. Otherwise Deploy runs
 * directly. While the workspace holds a root Compose file, the setup segment asks the agent to change
 * the setup with the user's request; it is enabled only while the deployment is stopped.
 */
export const DeployButton = ({ session, disabled = false }: { session: Session; disabled?: boolean }) => {
  const { deployment, busy, error, start, stop, changeSetup } = useDeployment(session.id);
  const [setupOpen, setSetupOpen] = useState(false);
  const logOpen = useSessionsStore((store) => store.byId[session.id]?.deploymentLogOpen ?? false);
  const hasLog = useSessionsStore((store) => Boolean(store.byId[session.id]?.deploymentLog.length));
  if (!deployment) return null;
  const { state, cleanupRequired, result, phase } = deployment;
  const starting = state === 'starting';
  const stopping = state === 'stopping';
  const canStop = starting || state === 'running' || (state === 'failed' && cleanupRequired);
  const preparing = !canStop && session.deploymentSetup === 'preparing'
    && (session.status === 'working' || session.status === 'waiting');
  const label = stopping ? 'Stopping…' : starting ? 'Deploying…' : preparing ? 'Preparing…' : canStop ? 'Stop'
    : state === 'failed' ? 'Retry' : 'Deploy';
  const blocked = disabled || busy || stopping || session.status === 'closed'
    || (!canStop && (session.status !== 'ready' || Boolean(session.pending)));
  const failure = error ?? result?.reason?.message ?? null;
  const hint = preparing ? 'The agent is preparing the deployment in the chat'
    : failure ?? (starting ? `${phase ?? 'Preparing the deployment'}\nClick to cancel.` : stopping ? phase : null);
  const withLogs = (hasLog || Boolean(deployment.operationId)) && !deploymentConsoleHidden(session);
  const withSetup = Boolean(session.deploymentConfigured);
  const setupBlocked = disabled || busy || canStop || stopping || preparing
    || session.status !== 'ready' || Boolean(session.pending);

  return (
    <div className="inline-flex min-w-0 shrink-0 items-stretch">
      <HeaderActionHint hint={hint}>
        <Button variant={canStop ? 'secondary' : 'brand'} size="sm" disabled={blocked}
          className={cn(HEADER_ACTION_CLASS, (withLogs || withSetup) && 'rounded-r-none')}
          ariaLabel={starting ? 'Cancel deployment' : `${label} deployment`}
          onClick={() => void (canStop ? stop() : start())}>
          {busy || starting || stopping || preparing ? <LoaderCircle className="size-4 animate-spin" />
            : canStop ? <Square className="size-4" /> : <Rocket className="size-4" />}
          <span className="hidden sm:inline">{label}</span>
          {failure && !preparing ? <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-danger-dot" /> : null}
        </Button>
      </HeaderActionHint>
      {withSetup ? <DeployGroupButton icon={Settings2} label="Change deployment setup" last={!withLogs}
        disabled={setupBlocked} onClick={() => setSetupOpen(true)} /> : null}
      {withLogs ? <DeployGroupButton icon={SquareTerminal} label="Deployment logs" last active={starting}
        expanded={logOpen} controls="deployment-logs-drawer"
        onClick={() => useSessionsStore.getState().setDeploymentLogOpen(session.id, !logOpen)} /> : null}
      {setupOpen ? <DeploymentSetupDialog busy={busy} error={error}
        onClose={() => setSetupOpen(false)}
        onSubmit={(instructions) => void changeSetup(instructions).then((sent) => { if (sent) setSetupOpen(false); })} /> : null}
    </div>
  );
};
