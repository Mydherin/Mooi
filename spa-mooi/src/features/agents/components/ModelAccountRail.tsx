import { useState } from 'react';
import { ModelAccountRailItem } from '@/features/agents/components/ModelAccountRailItem';
import { accountName } from '@/features/agents/lib/accountName';
import type { AccountCatalog } from '@/features/agents/types/AccountCatalog';
import type { ModelDefaults } from '@/features/agents/types/ModelDefaults';
import { SearchInput } from '@/shared/components/SearchInput';

interface ModelAccountRailProps {
  accounts: AccountCatalog[];
  selectedId: string;
  defaultsFor: (id: string) => ModelDefaults;
  isDirty: (id: string) => boolean;
  saveErrors: Record<string, string>;
  onSelect: (id: string) => void;
}

const SEARCH_THRESHOLD = 6;

/** The accounts as a horizontal strip on small screens and a sticky rail beside the editor on large ones. */
export const ModelAccountRail = ({ accounts, selectedId, defaultsFor, isDirty, saveErrors, onSelect }: ModelAccountRailProps) => {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const visible = needle ? accounts.filter(({ connection }) =>
    `${accountName(connection)} ${connection.label}`.toLowerCase().includes(needle)) : accounts;

  return <nav aria-label="Agent accounts" className="min-w-0 lg:sticky lg:top-6">
    <p className="mb-2.5 flex items-center justify-between px-1 text-[11px] font-extrabold tracking-[0.09em] text-ink-subtle uppercase">
      Accounts <span className="tabular-nums">{accounts.length}</span>
    </p>
    {accounts.length > SEARCH_THRESHOLD && <SearchInput value={query} onChange={setQuery} placeholder="Filter accounts" className="mb-2.5" />}
    <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 py-1 sm:-mx-8 sm:px-8 lg:-m-0.5 lg:max-h-[calc(100dvh-8rem)] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:p-0.5">
      {visible.map((account) => <ModelAccountRailItem key={account.connection.id} account={account}
        defaults={defaultsFor(account.connection.id)} selected={account.connection.id === selectedId}
        dirty={isDirty(account.connection.id)} saveError={Boolean(saveErrors[account.connection.id])}
        onSelect={() => onSelect(account.connection.id)} />)}
      {visible.length === 0 && <p className="px-1 py-6 text-sm text-ink-subtle">No account matches “{query}”.</p>}
    </div>
  </nav>;
};
