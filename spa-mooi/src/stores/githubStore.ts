import { create } from 'zustand';
import type { GithubState } from '@/stores/types/GithubState';

/**
 * Deliberately not persisted. Whether a GitHub account is linked is server state: a link revoked
 * from GitHub, or from another device, would otherwise keep showing as connected out of local
 * storage. It is read from the API on every mount instead.
 */
export const useGithubStore = create<GithubState>((set) => ({
  connection: null,
  status: 'idle',
  error: null,
  setConnection: (connection) => set({ connection, status: 'ready', error: null }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: error ? 'error' : 'ready' }),
  clear: () => set({ connection: null, status: 'ready', error: null }),
}));
