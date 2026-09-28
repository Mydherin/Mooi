import { useCallback, useEffect, useState } from 'react';
import { fetchProductionOverview } from '@/features/production/api/productionApi';
import type { ProductionOverview } from '@/features/production/types/ProductionOverview';

interface UseProductionOverview {
  overview: ProductionOverview | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Configuration state of a project; `refreshKey` reloads it whenever the caller learns of a change. */
export const useProductionOverview = (projectId: string | undefined, refreshKey: string): UseProductionOverview => {
  const [result, setResult] = useState<{ projectId?: string; overview: ProductionOverview | null; error: string | null }>(
    { projectId, overview: null, error: null });
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setLoading(true);
    fetchProductionOverview(projectId)
      .then((overview) => { if (active) setResult({ projectId, overview, error: null }); })
      .catch((failure: Error) => { if (active) setResult((current) => ({ ...current, projectId, error: failure.message })); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, refreshKey, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const same = result.projectId === projectId;

  return { overview: same ? result.overview : null, loading, error: same ? result.error : null, reload };
};
