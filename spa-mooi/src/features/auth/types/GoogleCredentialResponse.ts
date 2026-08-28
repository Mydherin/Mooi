export interface GoogleCredentialResponse {
  /** The OIDC ID token, the only Google credential that ever reaches our server. */
  credential: string;
}
