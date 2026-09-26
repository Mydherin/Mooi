import { useState } from 'react';
import { Bot, CircleAlert, RefreshCw } from 'lucide-react';
import { ModelAccountPanel } from '@/features/agents/components/ModelAccountPanel';
import { ModelAccountRail } from '@/features/agents/components/ModelAccountRail';
import { ModelDefaultsSaveBar } from '@/features/agents/components/ModelDefaultsSaveBar';
import { useModelCatalogs } from '@/features/agents/hooks/useModelCatalogs';
import { useModelDefaultsDrafts } from '@/features/agents/hooks/useModelDefaultsDrafts';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { Eyebrow } from '@/shared/components/Eyebrow';
import { cn } from '@/shared/utils/cn';

export const AdminModelDefaults = () => {
  const { accounts, status, error, refreshing, refresh, replaceConnection } = useModelCatalogs();
  const drafts = useModelDefaultsDrafts(accounts, replaceConnection);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = accounts.find(({ connection }) => connection.id === selectedId) ?? accounts[0];

  return <section className={cn('mt-10', drafts.dirtyIds.length > 0 && 'pb-24')}>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <Eyebrow>Agent configuration</Eyebrow>
        <h2 className="mt-1.5 text-2xl font-extrabold tracking-[-0.035em] text-ink">Model defaults</h2>
        <p className="mt-1 text-sm text-ink-muted">Pick the model and reasoning effort each account uses for every action.</p>
      </div>
      <Button variant="secondary" size="sm" disabled={refreshing} onClick={refresh}>
        <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} /> {refreshing ? 'Refreshing…' : 'Refresh catalogs'}
      </Button>
    </div>

    {status === 'loading' && <div role="status" aria-label="Loading accounts and models"
      className="grid gap-4 animate-pulse-soft lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="flex gap-2 lg:flex-col">{[0, 1, 2].map((index) => <div key={index} className="h-[88px] w-72 shrink-0 rounded-xl bg-surface-2 lg:w-full" />)}</div>
      <div className="h-96 rounded-[14px] bg-surface-2" />
    </div>}

    {error && <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
      <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
    </p>}

    {status === 'ready' && accounts.length === 0 && <EmptyState icon={Bot} title="No agent accounts yet"
      description="Connect a Claude or Codex account to choose which models it runs." />}

    {selected && <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
      <ModelAccountRail accounts={accounts} selectedId={selected.connection.id} defaultsFor={drafts.defaultsFor}
        isDirty={drafts.isDirty} saveErrors={drafts.saveErrors} onSelect={setSelectedId} />
      <ModelAccountPanel key={selected.connection.id} account={selected} defaults={drafts.defaultsFor(selected.connection.id)}
        dirty={drafts.isDirty(selected.connection.id)} saving={drafts.saving} saveError={drafts.saveErrors[selected.connection.id]}
        refreshing={refreshing} onRetry={refresh} onChange={(purpose, choice) => drafts.change(selected.connection.id, purpose, choice)} />
    </div>}

    <ModelDefaultsSaveBar dirtyCount={drafts.dirtyIds.length} saving={drafts.saving} savedAt={drafts.savedAt}
      onSave={() => void drafts.save()} onDiscard={drafts.discard} />
  </section>;
};
