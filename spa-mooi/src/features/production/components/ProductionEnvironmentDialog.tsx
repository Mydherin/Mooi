import { useState } from 'react';
import { KeyRound, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { updateProductionEnvironment } from '@/features/production/api/productionApi';
import type { ProductionEnvironmentVariable } from '@/features/production/types/ProductionEnvironmentVariable';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { cn } from '@/shared/utils/cn';

const PREFIX = 'MOOI_PRODUCTION_';
const NAME = /^[A-Z0-9_]{1,100}$/;

interface ProductionEnvironmentDialogProps {
  projectId: string;
  variables: ProductionEnvironmentVariable[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Values are write-only: a blank field keeps the stored value, so secrets never travel back to
 * the browser. Optional variables can be removed; required ones are read by the scripts.
 */
export const ProductionEnvironmentDialog = ({ projectId, variables, onClose, onSaved }: ProductionEnvironmentDialogProps) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<{ name: string; value: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = added.some((entry) => !NAME.test(entry.name));

  const save = async () => {
    const update: Record<string, string | null> = {};
    Object.entries(values).forEach(([name, value]) => { if (value.length > 0) update[name] = value; });
    removed.forEach((name) => { update[name] = null; });
    added.forEach(({ name, value }) => { if (value.length > 0) update[`${PREFIX}${name}`] = value; });
    if (Object.keys(update).length === 0) { onClose(); return; }
    setBusy(true); setError(null);
    try { await updateProductionEnvironment(projectId, update); onSaved(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };

  const field = 'h-10 min-w-0 rounded-[10px] border border-line bg-surface-2 px-3 font-mono text-xs text-ink outline-none focus:border-brand/50';

  return <Modal open size="lg" onClose={busy ? () => undefined : onClose} title="Environment variables"
    description="Stored encrypted in the platform and passed to deploy.sh and status.sh. Leave a field blank to keep its current value."
    footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button variant="brand" onClick={() => void save()} disabled={busy || invalid}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}{busy ? 'Saving…' : 'Save variables'}
      </Button></>}>
    <ul className="flex flex-col gap-3">
      {variables.map((variable) => {
        const removing = removed.has(variable.name);
        return <li key={variable.name} className={cn('flex flex-col gap-1.5', removing && 'opacity-50')}>
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-mono text-xs font-bold text-ink">{variable.name}</span>
            <span className="flex shrink-0 items-center gap-2 text-[11px] font-semibold">
              <span className={variable.configured ? 'text-success' : variable.required ? 'text-danger' : 'text-ink-subtle'}>
                {variable.configured ? 'Set' : variable.required ? 'Missing' : 'Not set'}</span>
              {!variable.required && variable.configured ? <button type="button" disabled={busy}
                onClick={() => setRemoved((current) => { const next = new Set(current); if (removing) next.delete(variable.name); else next.add(variable.name); return next; })}
                aria-label={removing ? `Keep ${variable.name}` : `Remove ${variable.name}`} title={removing ? 'Keep' : 'Remove'}
                className="grid size-7 place-items-center rounded-md text-ink-subtle hover:bg-danger-soft hover:text-danger">
                <Trash2 className="size-3.5" /></button> : null}
            </span>
          </div>
          <input type="password" autoComplete="new-password" spellCheck={false} disabled={busy || removing}
            value={values[variable.name] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [variable.name]: event.target.value }))}
            placeholder={variable.configured ? '•••••••• (unchanged)' : 'Value'} aria-label={`${variable.name} value`} className={field} />
        </li>;
      })}
      {added.map((entry, index) => <li key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <span className={cn(field, 'flex items-center gap-0.5 pr-1')}>
          <span className="shrink-0 text-ink-subtle">{PREFIX}</span>
          <input value={entry.name} autoFocus disabled={busy} aria-label="Variable name" placeholder="NAME"
            onChange={(event) => setAdded((current) => current.map((item, position) => position === index ? { ...item, name: event.target.value.toUpperCase() } : item))}
            className="h-full min-w-0 flex-1 bg-transparent outline-none" />
        </span>
        <input type="password" autoComplete="new-password" value={entry.value} disabled={busy} aria-label="Variable value" placeholder="Value"
          onChange={(event) => setAdded((current) => current.map((item, position) => position === index ? { ...item, value: event.target.value } : item))}
          className={field} />
        <button type="button" onClick={() => setAdded((current) => current.filter((_, position) => position !== index))} disabled={busy}
          aria-label="Discard variable" title="Discard" className="grid size-10 place-items-center rounded-[10px] text-ink-subtle hover:bg-surface-2 hover:text-ink">
          <Trash2 className="size-4" /></button>
      </li>)}
    </ul>
    {variables.length === 0 && added.length === 0 ? <p className="text-sm text-ink-muted">The scripts do not read any variable yet.</p> : null}
    <button type="button" onClick={() => setAdded((current) => [...current, { name: '', value: '' }])} disabled={busy}
      className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-xs font-bold text-ink-muted transition hover:bg-surface-2 hover:text-ink">
      <Plus className="size-3.5" />Add variable</button>
    {error ? <p role="alert" className="mt-4 rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">{error}</p> : null}
  </Modal>;
};
