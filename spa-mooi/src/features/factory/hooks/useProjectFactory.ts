import { useCallback, useEffect, useState } from 'react';
import { fetchFactory } from '@/features/factory/api/factoryApi';
import type { Factory } from '@/features/factory/types/Factory';
import { useLiveStore } from '@/stores/liveStore';

export interface UseProjectFactory {
  /** Null when the project has no factory; undefined until known. */
  factory: Factory | null | undefined;
  error: string | null;
  /** Adopts what an action answered, so the view never waits for the live announcement. */
  adopt: (factory: Factory | null) => void;
  reload: () => void;
}

/** The project's factory as mic-mooi holds it, kept live by `factory.updated` from any side. */
export const useProjectFactory = (projectId: string): UseProjectFactory => {
  const factory = useLiveStore((live) => (projectId in live.factories ? live.factories[projectId] : undefined));
  const epoch = useLiveStore((live) => live.epoch);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  const adopt = useCallback((next: Factory | null) => useLiveStore.getState().adoptFactory(projectId, next), [projectId]);

  useEffect(() => {
    let active = true;
    fetchFactory(projectId)
      .then((next) => { if (active) { adopt(next); setError(null); } })
      .catch((failure: Error) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [projectId, epoch, reloads, adopt]);

  return { factory, error, adopt, reload: () => setReloads((count) => count + 1) };
};
