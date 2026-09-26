import { useState } from 'react';
import { ModelOption } from '@/features/agents/components/ModelOption';
import { providerDefaultModel } from '@/features/agents/lib/providerDefaultModel';
import type { SessionProvider } from '@/features/sessions/types/SessionProvider';
import { SearchInput } from '@/shared/components/SearchInput';

interface ModelOptionListProps {
  name: string;
  label: string;
  catalog: SessionProvider;
  value: string;
  onChange: (model: string) => void;
  disabled: boolean;
}

const SEARCH_THRESHOLD = 8;

const effortHint = (efforts: string[]) => efforts.length ? `${efforts.length} effort level${efforts.length === 1 ? '' : 's'}` : 'No effort levels';

export const ModelOptionList = ({ name, label, catalog, value, onChange, disabled }: ModelOptionListProps) => {
  const [query, setQuery] = useState('');
  const fallback = providerDefaultModel(catalog);
  const missing = Boolean(value) && !catalog.models.some((model) => model.id === value);
  const needle = query.trim().toLowerCase();
  const models = needle ? catalog.models.filter((model) => `${model.label} ${model.id}`.toLowerCase().includes(needle)) : catalog.models;

  return <div className="space-y-2.5">
    {catalog.models.length > SEARCH_THRESHOLD && <SearchInput value={query} onChange={setQuery} placeholder={`Search ${catalog.models.length} models`} />}
    <div role="radiogroup" aria-label={label} className="grid max-h-96 gap-2 overflow-y-auto p-0.5 sm:grid-cols-2">
      <ModelOption name={name} value="" checked={!value} onSelect={() => onChange('')} disabled={disabled}
        title="Provider default" hint={fallback ? `Currently ${fallback.label}` : 'Chosen by the provider'}
        tag={<span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-extrabold tracking-wide text-ink-muted uppercase">Auto</span>} />
      {missing && <ModelOption name={name} value={value} checked onSelect={() => onChange(value)} disabled={disabled}
        tone="warning" title={value} hint="No longer offered by this account" />}
      {models.map((model) => <ModelOption key={model.id} name={name} value={model.id} checked={value === model.id}
        onSelect={() => onChange(model.id)} disabled={disabled} title={model.label}
        hint={<><span className="font-mono">{model.id}</span> · {effortHint(model.efforts)}</>} />)}
    </div>
    {needle && models.length === 0 && <p className="px-1 text-sm text-ink-subtle">No model matches “{query}”.</p>}
  </div>;
};
