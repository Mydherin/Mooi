import { useCallback, useEffect, useRef, useState } from 'react';
import { changeDeploymentSetup, startDeployment, stopDeployment } from '@/features/sessions/api/sessionsApi';
import type { DeploymentAction } from '@/features/sessions/types/DeploymentAction';
import { useSessionsStore } from '@/stores/sessionsStore';

/** Only request state is local; snapshots always come from the session store, kept live by its stream. */
export const useDeployment = (sessionId: string) => {
  const deployment = useSessionsStore((state) => state.sessions.find((item) => item.id === sessionId)?.deployment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    pending.current = false;
    setBusy(false);
    setError(null);
    return () => { generation.current += 1; };
  }, [sessionId]);

  /** `setup` asks the agent to change the setup with `instructions`, only while the deployment is stopped. */
  const run = useCallback(async (action: DeploymentAction | 'setup', instructions = ''): Promise<boolean> => {
    if (pending.current) return false;
    const current = useSessionsStore.getState().sessions.find((item) => item.id === sessionId);
    if (!current || current.status === 'closed' || current.deployment.state === 'stopping') return false;
    if (action !== 'stop' && (current.status !== 'ready' || current.pending || current.deployment.cleanupRequired
        || current.deployment.state === 'starting' || current.deployment.state === 'running')) return false;
    const version = generation.current;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const snapshot = await (action === 'start' ? startDeployment(sessionId)
        : action === 'setup' ? changeDeploymentSetup(sessionId, instructions) : stopDeployment(sessionId));
      if (version !== generation.current) return false;
      useSessionsStore.getState().setDeployment(sessionId, snapshot);
      return true;
    } catch (failure) {
      if (version === generation.current) setError(failure instanceof Error ? failure.message : 'Deployment request failed.');
      return false;
    } finally {
      if (version === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }, [sessionId]);

  return { deployment, busy, error, start: () => run('start'), stop: () => run('stop'),
    changeSetup: (instructions: string) => run('setup', instructions) };
};
