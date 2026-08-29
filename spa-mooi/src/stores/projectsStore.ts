import { create } from 'zustand';
import type { ProjectsState } from '@/stores/types/ProjectsState';

/**
 * Deliberately not persisted, like the GitHub link it depends on. Which repositories belong to a
 * workspace is server state: one added on another device, or removed there, would otherwise keep
 * showing out of local storage. It is read from the API on every shell mount instead.
 */
export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: [],
  status: 'idle',
  error: null,
  setProjects: (projects) => set({ projects, status: 'ready', error: null }),
  // Newest first, matching the order the API returns: a repository just added belongs at the top.
  upsertProject: (project) =>
    set((state) => ({
      projects: [project, ...state.projects.filter((current) => current.id !== project.id)],
    })),
  removeProject: (projectId) =>
    set((state) => ({ projects: state.projects.filter((project) => project.id !== projectId) })),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: error ? 'error' : 'ready' }),
  clear: () => set({ projects: [], status: 'ready', error: null }),
}));
