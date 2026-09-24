import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDeployment, startDeployment, stopDeployment } from '@/features/sessions/api/sessionsApi';
import type { DeploymentAction } from '@/features/sessions/types/DeploymentAction';
import { useSessionsStore } from '@/stores/sessionsStore';

/** Only request state is local; snapshots always come from the session store. */
export const useDeployment = (sessionId: string) => {
  const session = useSessionsStore((state) => state.sessions.find((item) => item.id === sessionId));
  const progress = useSessionsStore((state) => state.byId[sessionId]?.deploymentProgress);
  const streamState = useSessionsStore((state) => state.byId[sessionId]?.streamState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const pending = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    pending.current = false;
    setBusy(false);
    setError(null);
    setRefreshError(null);
    return () => { generation.current += 1; };
  }, [sessionId]);

  useEffect(() => {
    if (streamState && streamState !== 'open' && streamState !== 'closed') return;
    let cancelled = false;
    void fetchDeployment(sessionId).then((snapshot) => {
      if (!cancelled) {
        useSessionsStore.getState().setDeployment(sessionId, snapshot);
        setRefreshError(null);
      }
    }).catch((failure: unknown) => {
      if (!cancelled) setRefreshError(failure instanceof Error ? failure.message : 'Could not load the deployment.');
    });
    return () => { cancelled = true; };
  }, [sessionId, streamState]);

  const run = useCallback(async (action: DeploymentAction): Promise<boolean> => {
    if (pending.current) return false;
    const current = useSessionsStore.getState().sessions.find((item) => item.id === sessionId);
    if (!current || current.status === 'closed' || current.deployment.state === 'stopping') return false;
    if (action === 'start' && (current.status !== 'ready' || current.pending || current.deployment.cleanupRequired
        || current.deployment.state === 'starting' || current.deployment.state === 'running')) return false;
    const version = generation.current;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const snapshot = await (action === 'start' ? startDeployment(sessionId) : stopDeployment(sessionId));
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

  const deployment = session?.deployment;
  return {
    deployment, busy, error: error ?? refreshError,
    progress: progress?.operationId === deployment?.operationId
      && (deployment?.state === 'starting' || deployment?.state === 'stopping') ? progress : null,
    start: () => run('start'),
    stop: () => run('stop'),
  };
};
