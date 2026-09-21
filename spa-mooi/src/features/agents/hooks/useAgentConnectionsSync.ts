import { useEffect } from 'react';
import { fetchAgentConnections, fetchAgentProviders } from '@/features/agents/api/agentsApi';
import { useAgentsStore } from '@/stores/agentsStore';

/**
 * Loads the agent providers and the player's connections once, for the whole application shell.
 *
 * Mounted alongside `useProjectsSync` and `useGithubConnectionSync` rather than by the account
 * screen, so a session created straight from a project already has the connection state behind it.
 */
export const useAgentConnectionsSync = (): void => {
  useEffect(() => {
    let cancelled = false;

    useAgentsStore.getState().setStatus('loading');
    Promise.all([fetchAgentProviders(), fetchAgentConnections()])
      .then(([providers, connections]) => {
        if (!cancelled) {
          useAgentsStore.getState().setProviders(providers);
          useAgentsStore.getState().setConnections(connections);
        }
      })
      .catch((failure: Error) => {
        if (!cancelled) {
          useAgentsStore.getState().setError(failure.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);
};
