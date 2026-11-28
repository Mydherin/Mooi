import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { env } from '@/config/env';
import type { SidebarState } from '@/stores/types/SidebarState';

/** A layout preference of this device: the desktop sidebar stays collapsed or expanded across visits. */
export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
    }),
    { name: `${env.storagePrefix}:sidebar`, version: 1, partialize: ({ collapsed }) => ({ collapsed }) },
  ),
);
