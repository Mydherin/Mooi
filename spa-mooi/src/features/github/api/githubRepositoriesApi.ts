import { authenticatedFetch } from '@/features/auth/lib/authenticatedFetch';
import type { GithubRepositoriesResponse } from '@/features/github/types/GithubRepositoriesResponse';
import type { GithubRepository } from '@/features/github/types/GithubRepository';
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage';

const REPOSITORIES_PATH = '/me/github/repositories';

/**
 * Reads the repositories behind the player's GitHub link.
 *
 * The token never leaves the API, so this is a call to Mooi rather than to github.com: the browser
 * asks its own backend, which holds the grant and talks to GitHub on the player's behalf.
 */
export const fetchGithubRepositories = async (): Promise<GithubRepository[]> => {
  const response = await authenticatedFetch(REPOSITORIES_PATH);

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Could not load your GitHub repositories.'));
  }

  const body = (await response.json()) as GithubRepositoriesResponse;

  return body.repositories;
};
