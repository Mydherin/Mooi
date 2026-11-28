import { useRef, useState } from 'react';
import { Check, ExternalLink, GitPullRequestArrow, LoaderCircle, Send, X } from 'lucide-react';
import { decideFactoryChange, requestFactoryChange } from '@/features/factory/api/factoryApi';
import { factoryDocumentUrl } from '@/features/factory/lib/factoryDocumentUrl';
import { useFactoryChangeRequests } from '@/features/factory/hooks/useFactoryChangeRequests';
import type { FactoryChangeRequest } from '@/features/factory/types/FactoryChangeRequest';
import { DictationButton } from '@/features/dictation/components/DictationButton';
import { useDictation } from '@/features/dictation/hooks/useDictation';
import { Badge } from '@/shared/components/data-display/Badge';
import { Button } from '@/shared/components/actions/Button';
import { Card } from '@/shared/components/data-display/Card';
import { Eyebrow } from '@/shared/components/data-display/Eyebrow';
import type { Tone } from '@/shared/types/Tone';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';

const TONES: Record<FactoryChangeRequest['status'], Tone> = {
  queued: 'neutral', analyzing: 'brand', 'awaiting-confirmation': 'warning', applied: 'success', rejected: 'neutral',
};
const LABELS: Record<FactoryChangeRequest['status'], string> = {
  queued: 'Queued', analyzing: 'Analyzing', 'awaiting-confirmation': 'Confirm scope', applied: 'Applied', rejected: 'Rejected',
};

interface FactoryChangeRequestsProps {
  projectId: string;
  revision: string;
  fullName: string;
  branch: string;
}

/**
 * Decided changes, applied by the loop at its next safe point: a composer (the chat queues the same
 * requests), the list with each analysis, and confirm or reject for the ones that alter the scope.
 */
export const FactoryChangeRequests = ({ projectId, revision, fullName, branch }: FactoryChangeRequestsProps) => {
  const { changes, error, adopt } = useFactoryChangeRequests(projectId, revision);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const dictation = useDictation(field);

  const run = async (key: string, action: () => Promise<FactoryChangeRequest>) => {
    setBusy(key);
    setActionError(null);
    try {
      adopt(await action());
      return true;
    } catch (failure) {
      setActionError((failure as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const submit = () => {
    const value = text.trim();
    if (!value || busy) return;
    dictation.finish();
    void run('new', () => requestFactoryChange(projectId, value)).then((ok) => { if (ok) setText(''); });
  };

  return (
    <Card as="section" className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Eyebrow className="flex-1">Change requests</Eyebrow>
        <a href={factoryDocumentUrl(fullName, branch, 'DECISIONS.md')} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-subtle transition hover:text-ink focus-visible:outline-2 focus-visible:outline-brand">
          Decisions<ExternalLink className="size-3" />
        </a>
      </div>

      <div className="rounded-control border border-line bg-surface-2 transition focus-within:border-brand/50">
        <textarea ref={field} rows={2} value={text} maxLength={8000} disabled={busy === 'new'}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit(); }
          }}
          placeholder="Describe a decided change, complete and self-contained…"
          className="block min-h-16 w-full resize-y bg-transparent p-3 text-[13px] leading-6 text-ink placeholder:text-ink-subtle focus:outline-none disabled:opacity-60" />
        <div className="flex items-center justify-end gap-1.5 border-t border-line p-1.5">
          <DictationButton field={field} dictation={dictation} disabled={busy === 'new'} className="size-8" />
          <Button variant="secondary" size="sm" onClick={submit} disabled={!text.trim() || busy !== null}>
            {busy === 'new' ? <LoaderCircle className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Queue
          </Button>
        </div>
      </div>

      {error || actionError ? <p role="alert" className="text-[12.5px] text-danger">{actionError ?? error}</p> : null}

      {changes.length === 0 ? (
        <p className="flex items-center gap-2 text-[13px] text-ink-subtle"><GitPullRequestArrow className="size-4" />No change requests.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {changes.map((change) => (
            <li key={change.id} className="flex flex-col gap-1.5 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11.5px] font-semibold text-ink">CR-{change.number}</span>
                <Badge tone={TONES[change.status]}>{LABELS[change.status]}</Badge>
                <span className="ml-auto text-[11.5px] text-ink-subtle">{formatRelativeTime(change.createdAt)}</span>
              </div>
              <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap text-ink">{change.text}</p>
              {change.analysis ? (
                <p className="rounded-control bg-surface-2 px-3 py-2 text-[12px] leading-relaxed break-words whitespace-pre-wrap text-ink-muted">
                  {change.analysis}
                </p>
              ) : null}
              {change.status === 'awaiting-confirmation' ? (
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <Button variant="brand" size="sm" disabled={busy !== null}
                    onClick={() => void run(change.id, () => decideFactoryChange(projectId, change.id, true))}>
                    {busy === change.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}Accept scope change
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy !== null}
                    onClick={() => void run(change.id, () => decideFactoryChange(projectId, change.id, false))}>
                    <X className="size-3.5" />Reject
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
};
