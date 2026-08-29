/** The authorize URL is built by the API so the client id and the signed state stay server-side. */
export interface GithubAuthorizationResponse {
  authorizeUrl: string;
}
