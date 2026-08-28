import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { env } from '@/config/env';
import type { AuthState } from '@/stores/types/AuthState';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      player: null,
      session: null,
      setSession: (player, session) => set({ player, session }),
      setPlayer: (player) => set({ player }),
      clear: () => set({ player: null, session: null }),
    }),
    { name: `${env.storagePrefix}:auth`, version: 2 },
  ),
);
