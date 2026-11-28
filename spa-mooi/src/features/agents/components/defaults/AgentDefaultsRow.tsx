import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { CatalogState } from '@/features/agents/hooks/useEngineDefaults';
import { modelChoiceIssue } from '@/features/agents/lib/modelChoiceIssue';
import { providerDefaultModel } from '@/features/agents/lib/providerDefaultModel';
import type { AdminAgentProvider } from '@/features/agents/types/AdminAgentProvider';
import type { EngineDefaults } from '@/features/agents/types/EngineDefaults';
import { contextHandoverOptions, parseContextHandover } from '@/features/sessions/lib/contextHandover';
import { Spinner } from '@/shared/components/feedback/Spinner';
import { Alert } from '@/shared/components/feedback/Alert';
import { TextField } from '@/shared/components/forms/TextField';
import { SelectField } from '@/shared/components/forms/select/SelectField';
import { SegmentedControl } from '@/shared/components/navigation/SegmentedControl';

interface AgentDefaultsRowProps {
  defaults: EngineDefaults;
  provider?: AdminAgentProvider;
  catalog?: CatalogState;
  loadCatalog: (provider: string, adapter: string) => void;
  save: (value: EngineDefaults) => Promise<void>;
}

type SaveState = 'idle' | 'saving' | 'saved';

const providerLabel = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
const typed = (value: string) => value.trim() || null;

/** A free-text default, saved when the field is left (used while no catalog lists the choices). */
const TypedDefault = ({ label, value, placeholder, maxLength, disabled, onSave }: {
  label: string; value: string; placeholder: string; maxLength: number; disabled: boolean; onSave: (value: string | null) => void;
}) => {
  const [draft, setDraft] = useState(value);
  const [stored, setStored] = useState(value);
  if (stored !== value) {
    setStored(value);
    setDraft(value);
  }

  return (
    <div onBlur={() => { if (draft !== value) onSave(typed(draft)); }}>
      <TextField label={label} value={draft} onChange={setDraft} placeholder={placeholder} maxLength={maxLength} disabled={disabled}
        autoComplete="off" autoCapitalize="none" spellCheck={false} enterKeyHint="done" mono />
    </div>
  );
};

/**
 * One provider's session defaults: adapter, model, effort and context handover, each saved the
 * moment it changes. Without a catalog to choose from, model and effort are typed and saved on blur.
 */
export const AgentDefaultsRow = ({ defaults, provider, catalog: state, loadCatalog, save }: AgentDefaultsRowProps) => {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const adapters = provider?.adapters ?? [];
  const adapter = adapters.find((entry) => entry.id === defaults.sessionAdapter)?.id ?? adapters[0]?.id;
  const catalog = state?.catalog ?? null;
  const model = defaults.sessionModel ?? '';
  const effort = defaults.sessionEffort ?? '';
  const fallbackModel = catalog ? providerDefaultModel(catalog) : undefined;
  const selected = catalog ? (model ? catalog.models.find((entry) => entry.id === model) : fallbackModel) : undefined;
  const issue = modelChoiceIssue({ model, effort }, catalog);
  const label = provider?.label ?? providerLabel(defaults.provider);
  const saving = saveState === 'saving';
  const adapterLabelId = `${defaults.provider}-default-adapter`;

  useEffect(() => {
    if (adapter) loadCatalog(defaults.provider, adapter);
  }, [loadCatalog, defaults.provider, adapter]);

  useEffect(() => {
    if (saveState !== 'saved') return;
    const timer = window.setTimeout(() => setSaveState('idle'), 1800);
    return () => window.clearTimeout(timer);
  }, [saveState]);

  const persist = (change: Partial<EngineDefaults>) => {
    const next = { ...defaults, ...change };
    if (next.sessionModel === defaults.sessionModel && next.sessionEffort === defaults.sessionEffort
      && next.sessionAdapter === defaults.sessionAdapter
      && next.sessionContextHandover === defaults.sessionContextHandover) return;
    setSaveState('saving');
    setError(null);
    save(next).then(() => setSaveState('saved')).catch((failure: Error) => {
      setSaveState('idle');
      setError(failure.message);
    });
  };

  return (
    <section aria-label={`${label} defaults`} className="min-w-0 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <header className="mb-4 flex min-h-6 items-center justify-between gap-3">
        <h3 className="truncate text-headline text-ink">{label}</h3>
        <span aria-live="polite" className="flex shrink-0 items-center gap-1.5 text-footnote text-ink-subtle">
          {saving ? <><Spinner /> Saving</> : saveState === 'saved' ? <><Check aria-hidden className="size-4 text-success" /> Saved</> : null}
        </span>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        {adapters.length > 1 && adapter ? (
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
            <span id={adapterLabelId} className="text-footnote font-semibold text-ink">Adapter</span>
            <SegmentedControl labelledBy={adapterLabelId} value={adapter} className="w-full sm:w-auto sm:self-start"
              items={adapters.map((entry) => ({ id: entry.id, label: entry.label }))}
              // The first adapter is the built-in default: choosing it stores no override.
              onChange={(id) => persist({ sessionAdapter: id === adapters[0].id ? null : id })} />
          </div>
        ) : null}

        {catalog ? (
          <>
            <SelectField label="Model" value={model} disabled={saving}
              onChange={(value) => persist({ sessionModel: value || null, sessionEffort: null })}
              options={[
                { value: '', label: 'Provider default', description: fallbackModel?.label },
                ...catalog.models.map((entry) => ({ value: entry.id, label: entry.label, keywords: entry.id })),
                ...(issue === 'model' ? [{ value: model, label: model, description: 'Unavailable' }] : []),
              ]} />
            <SelectField label="Effort" value={effort} disabled={saving || (!selected?.efforts.length && !effort)}
              onChange={(value) => persist({ sessionEffort: value || null })}
              options={[
                { value: '', label: 'Auto', description: selected?.defaultEffort ?? undefined },
                ...(selected?.efforts ?? []).map((entry) => ({ value: entry, label: entry })),
                ...(issue === 'effort' ? [{ value: effort, label: effort, description: 'Unavailable' }] : []),
              ]} />
          </>
        ) : (
          <>
            <TypedDefault label="Model" value={model} placeholder="Provider default" maxLength={120} disabled={Boolean(state?.loading)}
              onSave={(value) => persist({ sessionModel: value })} />
            <TypedDefault label="Effort" value={effort} placeholder="Auto" maxLength={32} disabled={Boolean(state?.loading)}
              onSave={(value) => persist({ sessionEffort: value })} />
          </>
        )}

        <SelectField label="Context handover" disabled={saving} fieldClassName="sm:col-span-2"
          hint="Past this context, the agent wraps up and leaves a progress file for a fresh conversation."
          value={defaults.sessionContextHandover == null ? '' : String(defaults.sessionContextHandover)}
          onChange={(value) => persist({ sessionContextHandover: parseContextHandover(value) })}
          options={contextHandoverOptions(defaults.sessionContextHandover)} />
      </div>

      {error ? <Alert tone="danger" className="mt-4">{error}</Alert>
        : issue ? <Alert tone="warning" className="mt-4">The saved {issue} is not offered by this adapter. Choose another one.</Alert>
          : !catalog && state && !state.loading && state.error ? <p className="mt-4 text-footnote text-ink-subtle">{state.error}</p>
            : null}
    </section>
  );
};
