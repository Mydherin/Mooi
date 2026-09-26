import { ChevronRight } from 'lucide-react';
import { accountName } from '@/features/agents/lib/accountName';
import { modelChoiceIssue } from '@/features/agents/lib/modelChoiceIssue';
import { modelLabel } from '@/features/agents/lib/modelLabel';
import { MODEL_PURPOSES } from '@/features/agents/lib/modelPurposes';
import type { AccountCatalog } from '@/features/agents/types/AccountCatalog';
import type { ModelDefaults } from '@/features/agents/types/ModelDefaults';
import { Initials } from '@/shared/components/Initials';
import { StatusDot } from '@/shared/components/StatusDot';
import type { Tone } from '@/shared/types/Tone';
import { cn } from '@/shared/utils/cn';

interface ModelAccountRailItemProps {
  account: AccountCatalog;
  defaults: ModelDefaults;
  selected: boolean;
  dirty: boolean;
  saveError: boolean;
  onSelect: () => void;
}

const state = (account: AccountCatalog, defaults: ModelDefaults, dirty: boolean, saveError: boolean): [Tone, string] => {
  if (saveError) return ['danger', 'Save failed'];
  if (account.error) return ['danger', 'Catalog unavailable'];
  if (dirty) return ['info', 'Unsaved'];
  if (MODEL_PURPOSES.some(({ id }) => modelChoiceIssue(defaults[id], account.catalog))) return ['warning', 'Needs review'];
  if (!account.catalog) return ['neutral', 'Loading'];
  return ['success', 'Ready'];
};

export const ModelAccountRailItem = ({ account, defaults, selected, dirty, saveError, onSelect }: ModelAccountRailItemProps) => {
  const [tone, status] = state(account, defaults, dirty, saveError);
  return <button type="button" onClick={onSelect} aria-current={selected || undefined}
    className={cn('group flex w-72 shrink-0 snap-start items-center gap-3 rounded-xl border p-3 text-left transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:w-full',
      selected ? 'border-ink bg-surface ring-1 ring-ink' : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/60')}>
    <Initials value={account.connection.provider} className={cn(selected && '!bg-contrast !text-contrast-ink')} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-bold text-ink">{accountName(account.connection)}</span>
      <span className="mt-0.5 block truncate text-xs text-ink-subtle">
        {MODEL_PURPOSES.map(({ id }) => modelLabel(defaults[id], account.catalog)).join(' · ')}
      </span>
      <span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-ink-muted">
        <StatusDot tone={tone} pulse={tone === 'info'} /> {status}
      </span>
    </span>
    <ChevronRight className={cn('hidden size-4 shrink-0 text-ink-subtle transition lg:block', selected ? 'text-ink' : 'group-hover:translate-x-0.5')} />
  </button>;
};
