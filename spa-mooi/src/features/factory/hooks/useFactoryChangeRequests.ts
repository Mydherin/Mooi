import { useCallback, useEffect, useState } from 'react';
import { fetchFactoryChangeRequests } from '@/features/factory/api/factoryApi';
import type { FactoryChangeRequest } from '@/features/factory/types/FactoryChangeRequest';

export interface UseFactoryChangeRequests {
  changes: FactoryChangeRequest[];
  error: string | null;
  /** Adopts a request an action answered, ahead of the next read. */
  adopt: (change: FactoryChangeRequest) => void;
}

/** The factory's change requests, newest first, read again whenever the factory changes (`revision`). */
export const useFactoryChangeRequests = (projectId: string, revision: string): UseFactoryChangeRequests => {
  const [changes, setChanges] = useState<FactoryChangeRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchFactoryChangeRequests(projectId)
      .then((next) => { if (active) { setChanges(next); setError(null); } })
      .catch((failure: Error) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [projectId, revision]);

  const adopt = useCallback((change: FactoryChangeRequest) => setChanges((current) => (
    current.some((item) => item.id === change.id)
      ? current.map((item) => (item.id === change.id ? change : item))
      : [change, ...current])), []);

  return { changes, error, adopt };
};
