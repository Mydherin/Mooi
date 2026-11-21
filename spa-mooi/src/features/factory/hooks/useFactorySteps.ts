import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFactorySteps } from '@/features/factory/api/factoryApi';
import type { FactoryStep } from '@/features/factory/types/FactoryStep';

export interface UseFactorySteps {
  steps: FactoryStep[];
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  loadMore: () => void;
}

/**
 * The journal, newest first. Every change of `revision` (any factory write) refreshes the newest page
 * and keeps the older pages already shown, so a long journal never jumps back to its start.
 */
export const useFactorySteps = (projectId: string, revision: string): UseFactorySteps => {
  const [steps, setSteps] = useState<FactoryStep[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const older = useRef(false);

  useEffect(() => {
    let active = true;
    fetchFactorySteps(projectId)
      .then((page) => {
        if (!active) return;
        const fresh = new Set(page.steps.map((step) => step.id));
        setSteps((current) => [...page.steps, ...current.filter((step) => !fresh.has(step.id)
          && page.steps.length > 0 && step.startedAt < page.steps[page.steps.length - 1].startedAt)]);
        if (!older.current) setHasMore(page.hasMore);
        setError(null);
      })
      .catch((failure: Error) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, revision]);

  const loadMore = useCallback(() => {
    const last = steps[steps.length - 1];
    if (!last || loading) return;
    setLoading(true);
    fetchFactorySteps(projectId, last.startedAt)
      .then((page) => {
        older.current = true;
        setSteps((current) => [...current, ...page.steps.filter((step) => !current.some((item) => item.id === step.id))]);
        setHasMore(page.hasMore);
      })
      .catch((failure: Error) => setError(failure.message))
      .finally(() => setLoading(false));
  }, [projectId, steps, loading]);

  return { steps, hasMore, loading, error, loadMore };
};
