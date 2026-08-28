import { env } from '@/config/env';
import { getAccessToken } from '@/features/auth/lib/accessTokenProvider';
import { useAuthStore } from '@/stores/authStore';

const withAuth = (init: RequestInit | undefined, token: string): RequestInit => ({
  ...init,
  headers: { ...init?.headers, Authorization: `Bearer ${token}` },
});

/**
 * Fetches an API path with the current access token attached. On a 401 it renews
 * once against a forced token; a second 401 clears the store and throws.
 */
export const authenticatedFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  const url = `${env.apiBaseUrl}${path}`;
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
