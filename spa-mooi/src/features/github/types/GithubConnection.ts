/**
 * A GitHub account linked to the signed-in player, exactly as the API reports it.
 *
 * No token material of any kind: the browser never needs a GitHub credential, so it is never
 * given one. Both expiry fields are informational, and null when the grant does not expire.
 */
export interface GithubConnection {
  githubUserId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  connectedAt: string;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
}
