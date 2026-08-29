import type { GithubConnection } from '@/features/github/types/GithubConnection';

/** A null connection means "not linked", which is a state rather than an error. */
export interface GithubConnectionResponse {
  connection: GithubConnection | null;
}
