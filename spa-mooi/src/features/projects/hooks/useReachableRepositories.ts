import { useCallback, useEffect, useState } from 'react';
import { fetchGithubRepositories } from '@/features/github/api/githubRepositoriesApi';
import type { GithubRepository } from '@/features/github/types/GithubRepository';

interface UseReachableRepositories {
  repositories: GithubRepository[];
  installations: number | null;
  loading: boolean;
  failure: string | null;
  load: () => void;
}

/**
 * The repositories the linked GitHub account can reach, read each time `open` turns true rather
 * than kept in a store: the list belongs to GitHub, can change between two openings, and is only
 * needed while the import dialog is on screen.
 */
export const useReachableRepositories = (open: boolean): UseReachableRepositories => {
  const [repositories, setRepositories] = useState<GithubRepository[]>([]);
  const [installations, setInstallations] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setFailure(null);
    setInstallations(null);

    fetchGithubRepositories()
      .then((access) => {
        setRepositories(access.repositories);
        setInstallations(access.installations);
      })
      .catch((error: Error) => setFailure(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) {
      load();
    }
  }, [load, open]);

  return { repositories, installations, loading, failure, load };
};
