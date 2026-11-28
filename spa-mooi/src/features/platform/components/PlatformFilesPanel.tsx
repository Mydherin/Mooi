import { useEffect, useMemo, useState } from 'react';
import { FileClock, FileCode2, Pencil, Save, X } from 'lucide-react';
import type { PlatformDocumentField } from '@/features/platform/types/PlatformDocumentField';
import type { PlatformDocuments } from '@/features/platform/types/PlatformDocuments';
import { DiffLineRow } from '@/features/sessions/components/changes/DiffLineRow';
import { parseUnifiedDiff } from '@/features/sessions/lib/parseUnifiedDiff';
import type { ChangesSummary } from '@/features/sessions/types/ChangesSummary';
import type { DiffLine } from '@/features/sessions/types/DiffLine';
import type { FileDiffPayload } from '@/features/sessions/types/FileDiffPayload';
import { Button } from '@/shared/components/actions/Button';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { Spinner } from '@/shared/components/feedback/Spinner';
import { SegmentedControl } from '@/shared/components/navigation/SegmentedControl';
import { cn } from '@/shared/utils/cn';

type PlatformFiles = Record<string, string | null>;

interface PlatformFilesPanelProps<F> {
  fields: PlatformDocumentField<F>[];
  documents: PlatformDocuments<F> | null;
  summary: ChangesSummary | null;
  loadError: string | null;
  locked: boolean;
  /** Where the documents live and what writes them, for the empty state. */
  emptyDescription: string;
  fetchDiff: (path: string) => Promise<FileDiffPayload>;
  saveDraft: (files: F) => Promise<unknown>;
  onSaved: () => void;
}

type FilesView = 'changes' | 'draft' | 'active';

const asLines = (content: string): DiffLine[] => content.split('\n').map((text, index) =>
  ({ id: `line-${index}`, kind: 'context', oldLine: null, newLine: index + 1, content: text }));

/**
 * A platform configuration's documents, appearing one by one as the agent saves them. Changes show
 * what the live chat changed since it opened (without a chat, the pending draft against the active
 * version); editing lists every document so a missing one can be written here.
 */
export const PlatformFilesPanel = <F,>({ fields, documents, summary, loadError, locked, emptyDescription, fetchDiff,
  saveDraft, onSaved }: PlatformFilesPanelProps<F>) => {
  const [requested, setSelected] = useState(fields[0]?.name ?? '');
  const [view, setView] = useState<FilesView>('changes');
  const [diff, setDiff] = useState<DiffLine[]>([]);
  const [editing, setEditing] = useState<PlatformFiles | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = useMemo(() => new Map((summary?.files ?? []).map((file) => [file.path, file])), [summary]);
  const current = (documents?.draft ?? documents?.active ?? null) as PlatformFiles | null;
  const active = (documents?.active ?? null) as PlatformFiles | null;
  const text = (files: PlatformFiles | null, key: string) => files?.[key] ?? '';
  const listed = editing ? fields : fields.filter((document) => text(current, document.key).trim());
  const selected = listed.some((document) => document.name === requested) ? requested : listed[0]?.name ?? requested;
  const field = fields.find((document) => document.name === selected) ?? fields[0];
  const hasDraft = Boolean(documents?.draft);
  const views = [
    ...(changed.has(selected) ? [{ id: 'changes', label: 'Changes' }] : []),
    ...(hasDraft ? [{ id: 'draft', label: 'Draft' }] : []),
    ...(active ? [{ id: 'active', label: 'Active' }] : []),
  ];
  const visibleView: FilesView = views.some((item) => item.id === view) ? view : (views[0]?.id as FilesView | undefined) ?? 'draft';

  useEffect(() => {
    if (visibleView !== 'changes') return;
    let alive = true;
    fetchDiff(selected)
      .then(({ diff: patch }) => { if (alive) setDiff(parseUnifiedDiff(patch)); })
      .catch((failure: Error) => { if (alive) setError(failure.message); });
    return () => { alive = false; };
  }, [fetchDiff, selected, visibleView, documents?.revision, summary]);

  const content = text(visibleView === 'active' ? active : current, field.key);
  const lines = visibleView === 'changes' ? diff : asLines(content);

  const save = async () => {
    if (!editing) return;
    setBusy(true); setError(null);
    try { await saveDraft(editing as F); setEditing(null); onSaved(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };

  if (!documents && !loadError) {
    return <p className="flex h-full items-center justify-center gap-2 text-callout text-ink-muted"><Spinner />Loading files…</p>;
  }
  if (documents && !listed.length) {
    return <div className="flex h-full items-center justify-center"><EmptyState bare icon={FileCode2} title="No platform files yet" description={emptyDescription} /></div>;
  }

  const complete = editing ? fields.every(({ key }) => text(editing, key).trim().length > 0) : false;
  const written = content.trim().length > 0;
  const shownError = error ?? loadError;
  const startEditing = () => setEditing(Object.fromEntries(fields.map(({ key }) => [key, text(current, key)])));

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-1">
      <nav aria-label="Platform files" className="flex gap-1.5 overflow-x-auto overscroll-x-contain border-b border-line p-2 lg:flex-col lg:border-r lg:border-b-0 lg:p-3">
        {listed.map((document) => {
          const change = changed.get(document.name);
          const pending = !text(current, document.key).trim();
          const Icon = pending ? FileClock : FileCode2;
          return <button key={document.name} type="button" onClick={() => setSelected(document.name)} aria-pressed={selected === document.name}
            className={cn('flex min-h-11 min-w-44 shrink-0 items-center gap-2.5 rounded-control px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand lg:min-w-0',
              selected === document.name ? 'bg-surface-3 text-ink' : 'text-ink-muted hover-device:hover:bg-surface-2 hover-device:hover:text-ink')}>
            <Icon className={cn('size-4 shrink-0', pending && 'text-ink-subtle')} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-mono font-semibold">{document.name}</span>
              <span className="block truncate text-caption text-ink-subtle">{pending ? 'Not written yet' : document.summary}</span>
            </span>
            {change ? <span className="shrink-0 font-mono text-caption font-semibold tabular-nums"><span className="text-success">+{change.added}</span> <span className="text-danger">−{change.removed}</span></span> : null}
          </button>;
        })}
      </nav>

      <section aria-label={selected} className="flex min-h-0 min-w-0 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          <p className="min-w-0 flex-1 truncate font-mono text-mono font-semibold text-ink">{selected}
            <span className="ml-2 font-sans text-footnote font-medium text-ink-subtle">{editing ? 'Editing draft' : hasDraft ? 'Draft pending its first successful test' : 'Active'}</span></p>
          {!editing && views.length > 1 ? <SegmentedControl value={visibleView} onChange={(value) => setView(value as FilesView)}
            items={views} ariaLabel="File view" /> : null}
          {editing ? <>
            <Button variant="ghost" size="sm" icon={X} onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button variant="brand" size="sm" icon={Save} loading={busy} onClick={() => void save()} disabled={!complete}>Save draft</Button>
          </> : <Button variant="secondary" size="sm" icon={Pencil} disabled={locked} onClick={startEditing}>Edit</Button>}
        </div>
        {shownError ? <p role="alert" className="shrink-0 border-b border-danger/30 bg-danger-soft px-4 py-2 text-callout text-danger">{shownError}</p> : null}
        {editing ? <textarea key={selected} aria-label={`${selected} content`} spellCheck={false} value={text(editing, field.key)} disabled={busy}
          onChange={(event) => setEditing((draft) => draft ? { ...draft, [field.key]: event.target.value } : draft)}
          className="min-h-0 flex-1 resize-none overscroll-contain bg-surface-2 p-4 font-mono text-input leading-6 text-ink outline-none sm:text-mono" />
          : visibleView !== 'changes' && !written ? <div className="flex flex-1 items-center justify-center"><EmptyState bare icon={FileClock} title={`${selected} is not written yet`}
            description="It shows up here as soon as the agent saves it." /></div>
          : <div className="min-h-0 flex-1 overflow-auto overscroll-contain py-2 font-mono text-mono">
            {lines.map((line) => <DiffLineRow key={line.id} line={line} />)}
          </div>}
      </section>
    </div>
  );
};
