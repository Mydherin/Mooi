import { useCallback, useEffect, useState } from 'react';
import { fetchWorkspaces } from '@/features/sessions/api/sessionsApi';
import type { WorkspaceOverview } from '@/features/sessions/types/WorkspaceOverview';

interface UseProjectWorkspaces {
  overview: WorkspaceOverview | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Live disk overview of a project's clones. Always read from `mic-sessions`, never cached, so a
 * page reload shows exactly what is on disk. `revision` lets the caller refetch whenever the
 * session list it already tracks changes shape (a clone appears, finishes or goes away).
 */
export const useProjectWorkspaces = (projectId: string | undefined, revision: string): UseProjectWorkspaces => {
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchWorkspaces(projectId)
      .then((loaded) => {
        if (!cancelled) setOverview(loaded);
      })
      .catch((failure: Error) => {
        if (!cancelled) setError(failure.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, revision, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  return { overview, loading, error, reload };
};
