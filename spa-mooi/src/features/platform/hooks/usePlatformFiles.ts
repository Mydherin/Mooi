import { useCallback, useEffect, useState } from 'react';
import type { PlatformDocuments } from '@/features/platform/types/PlatformDocuments';
import type { ChangesSummary } from '@/features/sessions/types/ChangesSummary';

interface PlatformFilesState<F> {
  projectId?: string;
  documents: PlatformDocuments<F> | null;
  summary: ChangesSummary | null;
  error: string | null;
}

interface UsePlatformFiles<F> extends Omit<PlatformFilesState<F>, 'projectId'> {
  reload: () => void;
}

interface PlatformFilesSource<F> {
  fetchDocuments: (projectId: string) => Promise<PlatformDocuments<F>>;
  fetchChanges: (projectId: string) => Promise<ChangesSummary>;
}

/**
 * The platform documents and their pending changes, reloaded on every configuration revision the
 * stream announces: the tab count follows each document the agent saves, even while another tab is open.
 * `source` must be a stable (module-level) object.
 */
export const usePlatformFiles = <F>(projectId: string | undefined, revision: number, source: PlatformFilesSource<F>): UsePlatformFiles<F> => {
  const [state, setState] = useState<PlatformFilesState<F>>({ projectId, documents: null, summary: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    Promise.all([source.fetchDocuments(projectId), source.fetchChanges(projectId)])
      .then(([documents, summary]) => { if (active) setState({ projectId, documents, summary, error: null }); })
      .catch((failure: Error) => {
        if (active) setState((current) => current.projectId === projectId ? { ...current, error: failure.message }
          : { projectId, documents: null, summary: null, error: failure.message });
      });
    return () => { active = false; };
  }, [projectId, revision, attempt, source]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const same = state.projectId === projectId;

  return {
    documents: same ? state.documents : null,
    summary: same ? state.summary : null,
    error: same ? state.error : null,
    reload,
  };
};
