import { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { useSessionsStore } from '@/stores/sessionsStore';
import { fetchFileDiff } from '@/features/sessions/api/sessionsApi';
import { DiffLineRow } from '@/features/sessions/components/changes/DiffLineRow';
import { parseUnifiedDiff } from '@/features/sessions/lib/parseUnifiedDiff';
import type { DiffLine } from '@/features/sessions/types/DiffLine';
import { Button } from '@/shared/components/Button';

interface DiffViewProps {
  sessionId: string;
  path: string;
}

export const DiffView = ({ sessionId, path }: DiffViewProps) => {
  const revision = useSessionsStore((state) => state.byId[sessionId]?.changes);
  const [lines, setLines] = useState<DiffLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    fetchFileDiff(sessionId, path)
      .then((payload) => {
        if (!cancelled) {
          setLines(parseUnifiedDiff(payload.diff));
        }
      })
      .catch((failure: Error) => {
        if (!cancelled) {
          setError(failure.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, sessionId, path, revision]);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <p className="sticky top-0 z-10 truncate border-b border-line bg-surface px-4 py-2.5 font-mono text-[11px] font-medium text-ink-muted">
        {path}
      </p>

      {error ? (
        <div className="flex flex-col items-start gap-3 px-4 py-6 text-sm text-danger">
          <p>{error}</p>
          <Button variant="danger" size="sm" onClick={() => setAttempt((current) => current + 1)}>
            <RotateCw className="size-3.5" />
            Retry diff
          </Button>
        </div>
      ) : lines === null ? (
        <p className="px-4 py-6 text-sm text-ink-muted">Loading diff…</p>
      ) : lines.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-muted">No textual changes to show for this file.</p>
      ) : (
        <div className="py-2 font-mono text-xs leading-relaxed">
          {lines.map((line) => (
            <DiffLineRow key={line.id} line={line} />
          ))}
        </div>
      )}
    </div>
  );
};
