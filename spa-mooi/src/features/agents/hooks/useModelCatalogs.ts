import { useCallback, useEffect, useState } from 'react';
import { fetchAgentConnections } from '@/features/agents/api/agentsApi';
import type { AccountCatalog } from '@/features/agents/types/AccountCatalog';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import type { AgentsStatus } from '@/features/agents/types/AgentsStatus';
import { fetchSessionProvider } from '@/features/sessions/api/sessionsApi';

interface UseModelCatalogs {
  accounts: AccountCatalog[];
  status: AgentsStatus;
  error: string | null;
  refreshing: boolean;
  refresh: () => void;
  replaceConnection: (connection: AgentConnection) => void;
}

const loadCatalog = async (connection: AgentConnection): Promise<AccountCatalog> => {
  try {
    return { connection, catalog: await fetchSessionProvider(connection.provider, connection.id, true), error: null };
  } catch (failure) {
    return { connection, catalog: null, error: failure instanceof Error ? failure.message : 'Could not load models.' };
  }
};

/**
 * Every connected account with its live model catalog.
 *
 * A refresh keeps the current list on screen (`refreshing`) instead of going back to `loading`, so
 * unsaved choices and the selected account survive it.
 */
export const useModelCatalogs = (): UseModelCatalogs => {
  const [accounts, setAccounts] = useState<AccountCatalog[]>([]);
  const [status, setStatus] = useState<AgentsStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    fetchAgentConnections()
      .then((connections) => Promise.all(connections.map(loadCatalog)))
      .then((result) => {
        if (cancelled) return;
        setAccounts(result);
        setStatus('ready');
        setError(null);
      })
      .catch((failure: Error) => {
        if (cancelled) return;
        setError(failure.message);
        setStatus((current) => (current === 'ready' ? current : 'error'));
      })
      .finally(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
  }, [revision]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  const replaceConnection = useCallback((connection: AgentConnection) => {
    setAccounts((current) => current.map((account) =>
      account.connection.id === connection.id ? { ...account, connection } : account));
  }, []);

  return { accounts, status, error, refreshing, refresh, replaceConnection };
};
