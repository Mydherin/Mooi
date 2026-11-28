import { useState } from 'react';
import { KeyRound, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useEnvironmentDraft } from '@/features/platform/hooks/useEnvironmentDraft';
import { inheritedEnvironment } from '@/features/platform/lib/inheritedEnvironment';
import type { PlatformEnvironmentVariable } from '@/features/platform/types/PlatformEnvironmentVariable';
import { Button } from '@/shared/components/actions/Button';
import { IconButton } from '@/shared/components/actions/IconButton';
import { Badge } from '@/shared/components/data-display/Badge';
import { Alert } from '@/shared/components/feedback/Alert';
import { Spinner } from '@/shared/components/feedback/Spinner';
import { TextField } from '@/shared/components/forms/TextField';
import { Dialog } from '@/shared/components/overlays/dialog/Dialog';
import { cn } from '@/shared/utils/cn';

interface PlatformEnvironmentDialogProps {
  /** The name prefix of the variables this configuration owns, e.g. `MOOI_PRODUCTION_`. */
  prefix: string;
  description: string;
  variables: PlatformEnvironmentVariable[];
  /** The stored variables are still loading. */
  loading?: boolean;
  loadError?: string | null;
  emptyDescription?: string;
  save: (values: Record<string, string | null>) => Promise<unknown>;
  onClose: () => void;
  onSaved: () => void;
}

const status = (variable: PlatformEnvironmentVariable) => (variable.configured
  ? <Badge tone="success">Set</Badge>
  : variable.required ? <Badge tone="danger">Missing</Badge> : <Badge>Not set</Badge>);

/**
 * Values are write-only: a blank field keeps the stored value, so secrets never travel back to
 * the browser. Optional variables can be removed; required ones are read by the scripts. Inherited
 * variables only show whether they are set.
 */
export const PlatformEnvironmentDialog = ({
  prefix, description, variables, loading = false, loadError = null,
  emptyDescription = 'The scripts do not read any variable yet.', save, onClose, onSaved,
}: PlatformEnvironmentDialogProps) => {
  const draft = useEnvironmentDraft(prefix, variables);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (draft.changes === 0) { onClose(); return; }
    setBusy(true); setError(null);
    try { await save(draft.update); onSaved(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };

  return <Dialog open size="lg" onClose={onClose} dismissible={!busy} title="Environment variables"
    description={`${description} Leave a field blank to keep its current value.`}
    footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button variant="brand" icon={KeyRound} loading={busy} onClick={() => void submit()} disabled={!draft.valid || loading}>
        Save variables</Button></>}>
    <div className="flex flex-col gap-4">
      {loadError ? <Alert tone="danger">{loadError}</Alert> : null}
      {variables.map((variable) => {
        const removing = draft.removed.has(variable.name);
        const removable = !variable.required && !variable.inherited && variable.configured;
        return <div key={variable.name} className={cn('flex min-w-0 flex-col gap-1.5', removing && 'opacity-60')}>
          {variable.inherited ? <>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate font-mono text-mono font-semibold text-ink">{variable.name}</span>
              {status(variable)}
            </div>
            <p className="rounded-control bg-surface-2 px-3 py-2.5 text-footnote text-ink-muted">
              Managed in {inheritedEnvironment(variable.name).owner}.</p>
          </> : <TextField label={variable.name} mono type="password" autoComplete="new-password" spellCheck={false} enterKeyHint="next"
            value={draft.values[variable.name] ?? ''} onChange={(value) => draft.setValue(variable.name, value)}
            disabled={busy || removing} placeholder={variable.configured ? '•••••••• (unchanged)' : 'Value'}
            labelAction={status(variable)} hint={removing ? 'Removed when you save.' : undefined}
            trailing={removable ? <IconButton size="sm" icon={removing ? RotateCcw : Trash2} disabled={busy}
              label={removing ? `Keep ${variable.name}` : `Remove ${variable.name}`} onClick={() => draft.toggleRemoved(variable.name)} /> : undefined} />}
        </div>;
      })}
      {draft.added.map((entry) => <div key={entry.key} className="grid min-w-0 gap-3 rounded-card border border-line p-3 sm:grid-cols-2">
        <TextField label="Name" mono value={entry.name} autoFocus autoCapitalize="characters" spellCheck={false} autoComplete="off" enterKeyHint="next"
          placeholder="NAME" disabled={busy} onChange={(name) => draft.edit(entry.key, { name })}
          error={draft.nameErrors[entry.key]} hint={`Saved with the ${prefix} prefix.`} />
        <TextField label="Value" mono type="password" autoComplete="new-password" spellCheck={false} enterKeyHint="done"
          placeholder="Value" disabled={busy} value={entry.value} onChange={(value) => draft.edit(entry.key, { value })}
          trailing={<IconButton size="sm" icon={X} label="Discard variable" disabled={busy} onClick={() => draft.discard(entry.key)} />} />
      </div>)}
      {loading ? <p className="flex items-center gap-2 text-callout text-ink-muted"><Spinner />Loading variables…</p>
        : variables.length === 0 && draft.added.length === 0 ? <p className="text-callout text-ink-muted">{emptyDescription}</p> : null}
      <div><Button variant="ghost" size="sm" icon={Plus} onClick={draft.add} disabled={busy || loading}>Add variable</Button></div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  </Dialog>;
};
