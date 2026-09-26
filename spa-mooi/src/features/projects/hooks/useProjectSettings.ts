import { useCallback, useState } from 'react';
import { updateProject } from '@/features/projects/api/projectsApi';
import type { ProjectSettings } from '@/features/projects/types/ProjectSettings';
import { useProjectsStore } from '@/stores/projectsStore';

interface UseProjectSettings {
  saving: boolean;
  error: string | null;
  save: (settings: ProjectSettings) => Promise<boolean>;
}

/**
 * Edits the player-owned settings of one project, with its own `saving` and `error` so a failed
 * change is reported next to the control that made it, not next to unrelated project actions.
 */
export const useProjectSettings = (projectId: string): UseProjectSettings => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (settings: ProjectSettings): Promise<boolean> => {
      setSaving(true);
      setError(null);

      try {
        useProjectsStore.getState().replaceProject(await updateProject(projectId, settings));

        return true;
      } catch (failure) {
        setError((failure as Error).message);

        return false;
      } finally {
        setSaving(false);
      }
    },
    [projectId],
  );

  return { saving, error, save };
};
