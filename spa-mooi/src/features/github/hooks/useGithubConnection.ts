import { useCallback, useEffect } from 'react';
import {
  disconnectGithub,
  fetchGithubConnection,
  startGithubAuthorization,
} from '@/features/github/api/githubApi';
import { useGithubStore } from '@/stores/githubStore';
import type { GithubConnection } from '@/features/github/types/GithubConnection';
import type { GithubConnectionStatus } from '@/features/github/types/GithubConnectionStatus';

interface UseGithubConnection {
  connection: GithubConnection | null;
  status: GithubConnectionStatus;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  reload: () => void;
}

/**
 * The account screen's view of the GitHub link: loads it on mount, and exposes the two actions
 * that change it. Reading it also renews the stored GitHub token server-side, so simply opening
 * the screen keeps the link alive.
 */
export const useGithubConnection = (): UseGithubConnection => {
  const connection = useGithubStore((state) => state.connection);
  const status = useGithubStore((state) => state.status);
  const error = useGithubStore((state) => state.error);

  const load = useCallback((): (() => void) => {
    let cancelled = false;

    useGithubStore.getState().setStatus('loading');
    fetchGithubConnection()
      .then((loaded) => {
        if (!cancelled) {
          useGithubStore.getState().setConnection(loaded);
        }
      })
      .catch(() => {
        if (!cancelled) {
          useGithubStore.getState().setError('Could not load your GitHub connection.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  /**
   * Leaves the application on purpose: the authorization happens on github.com, and the callback
   * comes back to a route of ours that finishes the exchange.
   */
  const connect = useCallback(() => {
    useGithubStore.getState().setStatus('connecting');
    startGithubAuthorization()
      .then((authorizeUrl) => {
        window.location.assign(authorizeUrl);
      })
      .catch(() => {
        useGithubStore.getState().setError('Could not start the GitHub authorization.');
      });
  }, []);

  const disconnect = useCallback(() => {
    useGithubStore.getState().setStatus('loading');
    disconnectGithub()
      .then(() => {
        useGithubStore.getState().clear();
      })
      .catch(() => {
        useGithubStore.getState().setError('Could not disconnect your GitHub account.');
      });
  }, []);

  const reload = useCallback(() => {
    load();
  }, [load]);

  return { connection, status, error, connect, disconnect, reload };
};
