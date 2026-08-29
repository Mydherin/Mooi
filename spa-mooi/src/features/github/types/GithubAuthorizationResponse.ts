/**
 * The two doors of the integration, both built by the API so the client id and the signed state
 * stay server-side. `authorizeUrl` is where the player picks which GitHub account to use;
 * `installUrl` is where they pick which repositories Mooi may read.
 */
export interface GithubAuthorizationResponse {
  authorizeUrl: string;
  installUrl: string;
}
