/**
 * Where the connection is in its lifecycle. `connecting` is deliberately separate from `loading`:
 * one is reading the current link, the other is redeeming an authorization the player just granted.
 */
export type GithubConnectionStatus = 'idle' | 'loading' | 'connecting' | 'ready' | 'error';
