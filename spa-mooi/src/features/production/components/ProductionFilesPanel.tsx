import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCode2, LoaderCircle, Pencil, Save, X } from 'lucide-react';
import { fetchProductionChanges, fetchProductionDocuments, fetchProductionFileDiff, saveProductionDraft } from '@/features/production/api/productionApi';
import { PRODUCTION_DOCUMENTS } from '@/features/production/lib/productionDocuments';
import type { ProductionDocumentName } from '@/features/production/types/ProductionDocumentName';
import type { ProductionDocuments } from '@/features/production/types/ProductionDocuments';
import type { ProductionFiles } from '@/features/production/types/ProductionFiles';
import { DiffLineRow } from '@/features/sessions/components/changes/DiffLineRow';
import { parseUnifiedDiff } from '@/features/sessions/lib/parseUnifiedDiff';
import type { ChangesSummary } from '@/features/sessions/types/ChangesSummary';
import type { DiffLine } from '@/features/sessions/types/DiffLine';
import { Button } from '@/shared/components/Button';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { cn } from '@/shared/utils/cn';

interface ProductionFilesPanelProps {
  projectId: string;
  refreshKey: number;
  locked: boolean;
}

type FilesView = 'changes' | 'draft' | 'active';

const EMPTY: ProductionFiles = { manifest: '', script: '', statusScript: '' };

const asLines = (content: string): DiffLine[] => content.split('\n').map((text, index) =>
  ({ id: `line-${index}`, kind: 'context', oldLine: null, newLine: index + 1, content: text }));

/**
 * The three platform documents. A draft (from the agent or from here) shows as changes against the
 * active version until its first successful deployment publishes it.
 */
export const ProductionFilesPanel = ({ projectId, refreshKey, locked }: ProductionFilesPanelProps) => {
  const [documents, setDocuments] = useState<ProductionDocuments | null>(null);
  const [summary, setSummary] = useState<ChangesSummary | null>(null);
  const [selected, setSelected] = useState<ProductionDocumentName>('DEPLOYMENT.md');
  const [view, setView] = useState<FilesView>('changes');
  const [diff, setDiff] = useState<DiffLine[]>([]);
  const [editing, setEditing] = useState<ProductionFiles | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextDocuments, nextSummary] = await Promise.all([fetchProductionDocuments(projectId), fetchProductionChanges(projectId)]);
      setDocuments(nextDocuments);
      setSummary(nextSummary);
      setError(null);
    } catch (failure) { setError((failure as Error).message); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const changed = useMemo(() => new Map((summary?.files ?? []).map((file) => [file.path, file])), [summary]);
  const field = PRODUCTION_DOCUMENTS.find((document) => document.name === selected)!;
  const hasDraft = Boolean(documents?.draft);
  const views = [
    ...(changed.has(selected) && documents?.active ? [{ id: 'changes', label: 'Changes' }] : []),
    ...(hasDraft ? [{ id: 'draft', label: 'Draft' }] : []),
    ...(documents?.active ? [{ id: 'active', label: 'Active' }] : []),
  ];
  const visibleView: FilesView = views.some((item) => item.id === view) ? view : (views[0]?.id as FilesView | undefined) ?? 'draft';

  useEffect(() => {
    if (visibleView !== 'changes') return;
    let active = true;
    fetchProductionFileDiff(projectId, selected)
      .then(({ diff: text }) => { if (active) setDiff(parseUnifiedDiff(text)); })
      .catch((failure: Error) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [projectId, selected, visibleView, documents?.revision]);

  const source = visibleView === 'active' ? documents?.active : documents?.draft ?? documents?.active;
  const lines = visibleView === 'changes' ? diff : asLines(source?.[field.key] ?? '');

  const save = async () => {
    if (!editing) return;
    setBusy(true); setError(null);
    try { setDocuments(await saveProductionDraft(projectId, editing)); setEditing(null); await load(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };

  if (!documents && !error) {
    return <p className="flex h-full items-center justify-center gap-2 text-sm text-ink-muted"><LoaderCircle className="size-4 animate-spin" />Loading files…</p>;
  }
  if (documents && !documents.draft && !documents.active && !editing) {
    return <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-[10px] bg-surface-2 text-ink-subtle"><FileCode2 className="size-5" /></span>
      <p className="text-sm font-bold text-ink">No deployment files yet</p>
      <p className="max-w-sm text-sm text-ink-muted">The agent saves DEPLOYMENT.md, deploy.sh and status.sh here while it prepares the deployment.</p>
    </div>;
  }

  const complete = editing ? PRODUCTION_DOCUMENTS.every(({ key }) => (editing[key] ?? '').trim().length > 0) : false;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-1">
      <nav aria-label="Deployment files" className="flex gap-1.5 overflow-x-auto border-b border-line p-2 lg:flex-col lg:border-r lg:border-b-0 lg:p-3">
        {PRODUCTION_DOCUMENTS.map((document) => {
          const change = changed.get(document.name);
          return <button key={document.name} type="button" onClick={() => setSelected(document.name)} aria-pressed={selected === document.name}
            className={cn('flex min-w-44 shrink-0 items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand lg:min-w-0',
              selected === document.name ? 'bg-surface-3 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink')}>
            <FileCode2 className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-xs font-bold">{document.name}</span>
              <span className="block truncate text-[11px] text-ink-subtle">{document.summary}</span>
            </span>
            {change ? <span className="shrink-0 font-mono text-[10px] font-semibold"><span className="text-success">+{change.added}</span> <span className="text-danger">−{change.removed}</span></span> : null}
          </button>;
        })}
      </nav>

      <section aria-label={selected} className="flex min-h-0 min-w-0 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          <p className="min-w-0 flex-1 truncate font-mono text-xs font-bold text-ink">{selected}
            <span className="ml-2 font-sans font-medium text-ink-subtle">{editing ? 'Editing draft' : hasDraft ? 'Draft pending its first successful deployment' : 'Active'}</span></p>
          {!editing && views.length > 1 ? <SegmentedControl value={visibleView} onChange={(value) => setView(value as FilesView)}
            items={views} className="p-0.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:text-xs" /> : null}
          {editing ? <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={busy}><X className="size-4" />Cancel</Button>
            <Button variant="brand" size="sm" onClick={() => void save()} disabled={busy || !complete}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Save draft</Button>
          </> : <Button variant="secondary" size="sm" disabled={locked} onClick={() => setEditing({ ...EMPTY, ...(documents?.draft ?? documents?.active) })}>
            <Pencil className="size-4" />Edit</Button>}
        </div>
        {error ? <p role="alert" className="shrink-0 border-b border-danger/30 bg-danger-soft px-4 py-2 text-sm text-danger">{error}</p> : null}
        {editing ? <textarea key={selected} aria-label={`${selected} content`} spellCheck={false} value={editing[field.key] ?? ''} disabled={busy}
          onChange={(event) => setEditing((current) => current ? { ...current, [field.key]: event.target.value } : current)}
          className="min-h-0 flex-1 resize-none bg-surface-2 p-4 font-mono text-xs leading-6 text-ink outline-none" />
          : <div className="min-h-0 flex-1 overflow-auto py-2 font-mono text-xs leading-relaxed">
            {lines.map((line) => <DiffLineRow key={line.id} line={line} />)}
          </div>}
      </section>
    </div>
  );
};
