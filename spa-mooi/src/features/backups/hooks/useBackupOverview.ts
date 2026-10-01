import { useCallback, useEffect, useState } from 'react';
import { fetchBackupOverview } from '@/features/backups/api/backupsApi';
import type { BackupOverview } from '@/features/backups/types/BackupOverview';

interface UseBackupOverview {
  overview: BackupOverview | null;
  error: string | null;
  reload: () => void;
}

/** Backup configuration state of a project; `refreshKey` reloads it whenever the caller learns of a change. */
export const useBackupOverview = (projectId: string | undefined, refreshKey: string): UseBackupOverview => {
  const [result, setResult] = useState<{ projectId?: string; overview: BackupOverview | null; error: string | null }>(
    { projectId, overview: null, error: null });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    fetchBackupOverview(projectId)
      .then((overview) => { if (active) setResult({ projectId, overview, error: null }); })
      .catch((failure: Error) => { if (active) setResult((current) => ({ ...current, projectId, error: failure.message })); });
    return () => { active = false; };
  }, [projectId, refreshKey, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const same = result.projectId === projectId;

  return { overview: same ? result.overview : null, error: same ? result.error : null, reload };
};
