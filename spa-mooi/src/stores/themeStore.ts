import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { env } from '@/config/env';
import type { ThemeState } from '@/stores/types/ThemeState';

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    }),
    { name: `${env.storagePrefix}:theme` },
  ),
);
