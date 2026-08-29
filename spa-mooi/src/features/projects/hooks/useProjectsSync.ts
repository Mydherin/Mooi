import { useEffect } from 'react';
import { fetchProjects } from '@/features/projects/api/projectsApi';
import { useProjectsStore } from '@/stores/projectsStore';

/**
 * Loads the workspace projects once, for the whole application shell.
 *
 * Mounted by the shell rather than by the projects screen so a link opened straight into a single
 * project already has the list behind it, and so the sidebar never renders a workspace it has not
 * read yet.
 */
export const useProjectsSync = (): void => {
  useEffect(() => {
    let cancelled = false;

    useProjectsStore.getState().setStatus('loading');
    fetchProjects()
      .then((projects) => {
        if (!cancelled) {
          useProjectsStore.getState().setProjects(projects);
        }
      })
      .catch((failure: Error) => {
        if (!cancelled) {
          useProjectsStore.getState().setError(failure.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);
};
