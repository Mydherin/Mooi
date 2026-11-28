import { useEffect, useState } from 'react';
import { fetchSessionProvider } from '@/features/sessions/api/sessionsApi';
import type { Session } from '@/features/sessions/types/Session';
import type { SessionProvider } from '@/features/sessions/types/SessionProvider';

export interface SessionModels {
  modelOptions: SessionProvider['models'];
  modelLoading: boolean;
  modelError: string | null;
}

/** The models (and their efforts) the session's account and adapter offer, reloaded when either changes. */
export const useSessionModels = (session: Pick<Session, 'provider' | 'connectionId' | 'adapter'> | undefined): SessionModels => {
  const [modelOptions, setModelOptions] = useState<SessionProvider['models']>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const provider = session?.provider;
  const connectionId = session?.connectionId;
  const adapter = session?.adapter;

  useEffect(() => {
    if (!provider || !connectionId) return;

    let cancelled = false;
    setModelOptions([]);
    setModelLoading(true);
    setModelError(null);
    fetchSessionProvider(provider, connectionId, false, adapter)
      .then((loaded) => {
        if (cancelled) return;
        setModelOptions(loaded.models ?? []);
        setModelError(loaded.unavailable ?? null);
      })
      .catch((failure: Error) => {
        if (!cancelled) setModelError(failure.message);
      })
      .finally(() => {
        if (!cancelled) setModelLoading(false);
      });

    return () => { cancelled = true; };
  }, [provider, connectionId, adapter]);

  return { modelOptions, modelLoading, modelError };
};
