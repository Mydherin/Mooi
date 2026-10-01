import { useCallback, useEffect, useState } from 'react';
import { fetchProjectBackups } from '@/features/backups/api/backupHistoryApi';
import type { Backup } from '@/features/backups/types/Backup';

interface UseProjectBackups {
  backups: Backup[];
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  reload: () => void;
  loadMore: () => void;
}

/** A project's backups, newest first, reloaded whenever `refreshKey` changes. */
export const useProjectBackups = (projectId: string | undefined, refreshKey: string): UseProjectBackups => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [pages, setPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setLoading(true);
    Promise.all(Array.from({ length: pages }, (_, page) => fetchProjectBackups(projectId, page)))
      .then((results) => {
        if (!active) return;
        const seen = new Set<string>();
        setBackups(results.flatMap((result) => result.backups).filter((backup) => !seen.has(backup.id) && seen.add(backup.id)));
        setHasMore(results[results.length - 1]?.hasMore ?? false);
        setError(null);
      })
      .catch((failure: Error) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, refreshKey, revision, pages]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const loadMore = useCallback(() => setPages((value) => value + 1), []);

  return { backups, hasMore, loading, error, reload, loadMore };
};
