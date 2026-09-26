import { create } from 'zustand';
import type { AgentsState } from '@/stores/types/AgentsState';

/**
 * Deliberately not persisted. Which agent providers are linked is server state: a link revoked
 * from another device, or gone stale server-side, would otherwise keep showing out of local
 * storage. It is read from the API on every shell mount instead.
 */
export const useAgentsStore = create<AgentsState>((set) => ({
  providers: [],
  connections: [],
  status: 'idle',
  error: null,
  setProviders: (providers) => set({ providers }),
  setConnections: (connections) => set({ connections, status: 'ready', error: null }),
  upsertConnection: (connection) =>
    set((state) => ({
      connections: [connection, ...state.connections.filter((current) => current.id !== connection.id)],
    })),
  removeConnection: (id) =>
    set((state) => ({ connections: state.connections.filter((connection) => connection.id !== id) })),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: error ? 'error' : 'ready' }),
  clear: () => set({ providers: [], connections: [], status: 'ready', error: null }),
}));
