import { env } from '@/config/env';
import { getAccessToken } from '@/features/auth/lib/accessTokenProvider';
import { useAuthStore } from '@/stores/authStore';

const withAuth = (init: RequestInit | undefined, token: string): RequestInit => ({
  ...init,
  headers: { ...init?.headers, Authorization: `Bearer ${token}` },
});

/**
 * The same contract as `authenticatedFetch`, against `mic-sessions` instead of `mic-mooi`: renews
 * the access token once on a 401 before giving up. `getAccessToken` is the auth feature's public
 * lib, imported directly exactly as `authenticatedFetch` does — both services accept the same
 * player token, so there is nothing sessions-specific to add beyond the base URL.
 */
export const sessionsFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  const url = `${env.sessionsBaseUrl}${path}`;
  const token = await getAccessToken();

  if (!token) {
    useAuthStore.getState().clear();
    throw new Error('Not authenticated');
  }

  let response = await fetch(url, withAuth(init, token));

  if (response.status !== 401) {
    return response;
  }

  const retryToken = await getAccessToken(true);

  if (!retryToken) {
    useAuthStore.getState().clear();
    throw new Error('Not authenticated');
  }

  response = await fetch(url, withAuth(init, retryToken));

  if (response.status === 401) {
    useAuthStore.getState().clear();
    throw new Error('Not authenticated');
  }

  return response;
};
