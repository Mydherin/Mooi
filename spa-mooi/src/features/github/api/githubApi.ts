import { authenticatedFetch } from '@/features/auth/lib/authenticatedFetch';
import type { GithubAuthorizationResponse } from '@/features/github/types/GithubAuthorizationResponse';
import type { GithubConnection } from '@/features/github/types/GithubConnection';
import type { GithubConnectionResponse } from '@/features/github/types/GithubConnectionResponse';

const AUTHORIZATION_PATH = '/me/github/authorization';
const CONNECTION_PATH = '/me/github/connection';

/**
 * Opens the flow. The API answers with a ready-made authorize URL carrying a state it signed for
 * this player, so nothing here has to know the client id or protect the round trip itself.
 */
export const startGithubAuthorization = async (): Promise<string> => {
  const response = await authenticatedFetch(AUTHORIZATION_PATH, { method: 'POST' });

  if (!response.ok) {
    throw new Error(`Request to ${AUTHORIZATION_PATH} failed with ${response.status}`);
  }

  const body = (await response.json()) as GithubAuthorizationResponse;

  return body.authorizeUrl;
};

/** Redeems the authorization code. Sent with the player's own token, which is what binds the link. */
export const completeGithubAuthorization = async (
  code: string,
  state: string,
): Promise<GithubConnection | null> => {
  const response = await authenticatedFetch(CONNECTION_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });

  if (!response.ok) {
    throw new Error(`Request to ${CONNECTION_PATH} failed with ${response.status}`);
  }

  const body = (await response.json()) as GithubConnectionResponse;

  return body.connection;
};

export const fetchGithubConnection = async (): Promise<GithubConnection | null> => {
  const response = await authenticatedFetch(CONNECTION_PATH);

  if (!response.ok) {
    throw new Error(`Request to ${CONNECTION_PATH} failed with ${response.status}`);
  }

  const body = (await response.json()) as GithubConnectionResponse;

  return body.connection;
};

export const disconnectGithub = async (): Promise<void> => {
  const response = await authenticatedFetch(CONNECTION_PATH, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`Request to ${CONNECTION_PATH} failed with ${response.status}`);
  }
};
