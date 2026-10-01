import { useCallback, useEffect, useState } from 'react';
import { fetchBackups } from '@/features/backups/api/backupHistoryApi';
import type { Backup } from '@/features/backups/types/Backup';

/** Every recorded backup across projects, newest first, refreshed every 15 seconds while visible. */
export const useBackups = () => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [pages, setPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => Promise.all(Array.from({ length: pages }, (_, page) => fetchBackups(page)))
      .then((results) => {
        if (!active) return;
        const seen = new Set<string>();
        setBackups(results.flatMap((result) => result.backups).filter((backup) => !seen.has(backup.id) && seen.add(backup.id)));
        setHasMore(results[results.length - 1]?.hasMore ?? false);
        setError(null);
      })
      .catch((failure: Error) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoading(false); });
    setLoading(true);
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [pages, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const loadMore = useCallback(() => setPages((value) => value + 1), []);

  return { backups, hasMore, loading, error, reload, loadMore };
};
