import { useEffect, useState } from 'react';
import { FileWarning, RotateCw } from 'lucide-react';
import { useSessionsStore } from '@/stores/sessionsStore';
import { fetchFileDiff } from '@/features/sessions/api/sessionsApi';
import { DiffLineRow } from '@/features/sessions/components/changes/DiffLineRow';
import { parseUnifiedDiff } from '@/features/sessions/lib/parseUnifiedDiff';
import type { DiffLine } from '@/features/sessions/types/DiffLine';
import type { DiffPreview } from '@/features/sessions/types/DiffPreview';
import { Button } from '@/shared/components/Button';
import { useIncrementalCount } from '@/shared/hooks/useIncrementalCount';

interface DiffViewProps {
  sessionId: string;
  path: string;
}

interface LoadedDiff {
  lines: DiffLine[];
  preview: DiffPreview;
  truncated: boolean;
}

const unreadable: Record<Exclude<DiffPreview, 'text'>, string> = {
  binary: 'Binary file — it has no plain-text preview.',
  too_large: 'This file is too large to preview.',
};

export const DiffView = ({ sessionId, path }: DiffViewProps) => {
  const revision = useSessionsStore((state) => state.byId[sessionId]?.changes);
  const [loaded, setLoaded] = useState<LoadedDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lines = loaded?.lines ?? [];
  const { count, more, sentinel } = useIncrementalCount(lines.length);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    fetchFileDiff(sessionId, path)
      .then((payload) => {
        if (!cancelled) {
          const preview = payload.preview ?? 'text';
          setLoaded({ lines: preview === 'text' ? parseUnifiedDiff(payload.diff) : [], preview,
            truncated: payload.truncated === true });
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
      ) : loaded === null ? (
        <p className="px-4 py-6 text-sm text-ink-muted">Loading diff…</p>
      ) : loaded.preview !== 'text' ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-ink-muted">
          <FileWarning aria-hidden="true" className="size-4 shrink-0" />
          {unreadable[loaded.preview]}
        </p>
      ) : lines.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-muted">No textual changes to show for this file.</p>
      ) : (
        <div className="py-2 font-mono text-xs leading-relaxed">
          {lines.slice(0, count).map((line) => (
            <DiffLineRow key={line.id} line={line} />
          ))}
          {more ? <div ref={sentinel} aria-hidden="true" className="h-px" /> : null}
          {loaded.truncated && !more ? (
            <p className="flex items-center gap-2 px-4 pt-3 pb-1 font-sans text-xs text-ink-muted">
              <FileWarning aria-hidden="true" className="size-3.5 shrink-0" />
              The rest of this diff is too long to show.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};
