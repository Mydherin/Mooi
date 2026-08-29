import { useCallback, useState } from 'react';
import {
  addProject,
  fetchProjects,
  removeProject,
} from '@/features/projects/api/projectsApi';
import type { Project } from '@/features/projects/types/Project';
import type { ProjectsStatus } from '@/features/projects/types/ProjectsStatus';
import { useProjectsStore } from '@/stores/projectsStore';

interface UseProjects {
  projects: Project[];
  status: ProjectsStatus;
  error: string | null;
  busy: boolean;
  actionError: string | null;
  add: (fullName: string) => Promise<Project | null>;
  remove: (projectId: string) => Promise<boolean>;
  reload: () => void;
  clearActionError: () => void;
}

/**
 * The workspace project list, plus the two actions that change it.
 *
 * Adding and removing carry their own `busy` and `actionError` rather than moving the list into
 * `loading`/`error`: a repository that fails to import must not blank out the projects already on
 * screen, and the message belongs next to the control that was pressed.
 */
export const useProjects = (): UseProjects => {
  const projects = useProjectsStore((state) => state.projects);
  const status = useProjectsStore((state) => state.status);
  const error = useProjectsStore((state) => state.error);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const add = useCallback(async (fullName: string): Promise<Project | null> => {
    setBusy(true);
    setActionError(null);

    try {
      const project = await addProject(fullName);

      useProjectsStore.getState().upsertProject(project);

      return project;
    } catch (failure) {
      setActionError((failure as Error).message);

      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const remove = useCallback(async (projectId: string): Promise<boolean> => {
    setBusy(true);
    setActionError(null);

    try {
      await removeProject(projectId);
      useProjectsStore.getState().removeProject(projectId);

      return true;
    } catch (failure) {
      setActionError((failure as Error).message);

      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const reload = useCallback(() => {
    useProjectsStore.getState().setStatus('loading');
    fetchProjects()
      .then((loaded) => {
        useProjectsStore.getState().setProjects(loaded);
      })
      .catch((failure: Error) => {
        useProjectsStore.getState().setError(failure.message);
      });
  }, []);

  const clearActionError = useCallback(() => setActionError(null), []);

  return { projects, status, error, busy, actionError, add, remove, reload, clearActionError };
};
