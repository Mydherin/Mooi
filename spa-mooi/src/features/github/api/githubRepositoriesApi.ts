import { authenticatedFetch } from '@/features/auth/lib/authenticatedFetch';
import type { GithubRepositoriesResponse } from '@/features/github/types/GithubRepositoriesResponse';
import type { GithubRepositoryAccess } from '@/features/github/types/GithubRepositoryAccess';
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage';

const REPOSITORIES_PATH = '/me/github/repositories';

/**
 * Reads the repositories behind the player's GitHub link, and how much of GitHub the link reaches.
 *
 * The token never leaves the API, so this is a call to Mooi rather than to github.com: the browser
 * asks its own backend, which holds the grant and talks to GitHub on the player's behalf.
 *
 * The installation count comes back with the list because the list alone cannot explain itself: a
 * short one means either that the player owns nothing else, or that Mooi was never granted access.
 */
export const fetchGithubRepositories = async (): Promise<GithubRepositoryAccess> => {
  const response = await authenticatedFetch(REPOSITORIES_PATH);

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Could not load your GitHub repositories.'));
  }

  const body = (await response.json()) as GithubRepositoriesResponse;

  return { repositories: body.repositories, installations: body.installations };
};
