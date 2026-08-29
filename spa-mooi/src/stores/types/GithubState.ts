import type { GithubConnection } from '@/features/github/types/GithubConnection';
import type { GithubConnectionStatus } from '@/features/github/types/GithubConnectionStatus';

export interface GithubState {
  connection: GithubConnection | null;
  status: GithubConnectionStatus;
  error: string | null;
  setConnection: (connection: GithubConnection | null) => void;
  setStatus: (status: GithubConnectionStatus) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}
