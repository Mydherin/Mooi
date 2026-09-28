import { useCallback, useEffect, useState } from 'react';
import { fetchProjectProductionDeployments } from '@/features/production/api/productionHistoryApi';
import type { ProductionDeployment } from '@/features/production/types/ProductionDeployment';

interface UseProjectProductionHistory {
  deployments: ProductionDeployment[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  remove: (operationId: string) => void;
}

/** The most recent persisted deployments of one project, reloaded whenever `refreshKey` changes. */
export const useProjectProductionHistory = (projectId: string | undefined, refreshKey: string): UseProjectProductionHistory => {
  const [deployments, setDeployments] = useState<ProductionDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setLoading(true);
    fetchProjectProductionDeployments(projectId)
      .then((page) => { if (active) { setDeployments(page.deployments); setError(null); } })
      .catch((failure: Error) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, refreshKey, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const remove = useCallback((operationId: string) =>
    setDeployments((current) => current.filter((item) => item.operationId !== operationId)), []);

  return { deployments, loading, error, reload, remove };
};
