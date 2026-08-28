import { create } from 'zustand';
import type { WorkspaceState } from '@/stores/types/WorkspaceState';

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activePane: 'chat',
  setActivePane: (activePane) => set({ activePane }),
  previewDevice: 'desktop',
  setPreviewDevice: (previewDevice) => set({ previewDevice }),
}));
