import { useGithubStore } from '@/stores/githubStore';

interface UseGithubLinked {
  linked: boolean;
  resolved: boolean;
}

/**
 * The one question every gate in the application asks.
 *
 * `resolved` matters as much as `linked`: until the connection has been read, "not linked" is not
 * yet true, and rendering a connect prompt on that assumption would flash a demand at a player who
 * linked GitHub weeks ago.
 */
export const useGithubLinked = (): UseGithubLinked => {
  const connection = useGithubStore((state) => state.connection);
  const status = useGithubStore((state) => state.status);

  return { linked: connection !== null, resolved: status === 'ready' || status === 'error' };
};
