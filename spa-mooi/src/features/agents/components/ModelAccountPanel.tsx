import { CircleAlert, RefreshCw } from 'lucide-react';
import { ModelPurposeSection } from '@/features/agents/components/ModelPurposeSection';
import { accountName } from '@/features/agents/lib/accountName';
import { MODEL_PURPOSES } from '@/features/agents/lib/modelPurposes';
import type { AccountCatalog } from '@/features/agents/types/AccountCatalog';
import type { ModelChoice } from '@/features/agents/types/ModelChoice';
import type { ModelDefaults } from '@/features/agents/types/ModelDefaults';
import type { ModelPurposeId } from '@/features/agents/types/ModelPurposeId';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { Initials } from '@/shared/components/Initials';

interface ModelAccountPanelProps {
  account: AccountCatalog;
  defaults: ModelDefaults;
  dirty: boolean;
  saving: boolean;
  saveError: string | undefined;
  refreshing: boolean;
  onChange: (purpose: ModelPurposeId, choice: ModelChoice) => void;
  onRetry: () => void;
}

export const ModelAccountPanel = ({ account, defaults, dirty, saving, saveError, refreshing, onChange, onRetry }: ModelAccountPanelProps) => {
  const { connection, catalog, error } = account;

  return <Card as="article" className="overflow-hidden">
    <header className="flex flex-wrap items-center gap-3.5 border-b border-line px-5 py-4 sm:px-6">
      <Initials value={connection.provider} size="lg" className="!bg-contrast !text-contrast-ink" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-lg font-extrabold tracking-[-0.03em] text-ink">{accountName(connection)}</h3>
        <p className="mt-0.5 text-xs text-ink-subtle">
          {connection.label}{catalog ? ` · ${catalog.models.length} models available` : ''}
        </p>
      </div>
      {dirty ? <Badge tone="info">Unsaved</Badge> : catalog ? <Badge tone="success">Live catalog</Badge> : null}
    </header>

    <div className="p-5 sm:p-6">
      {saveError && <p role="alert" className="mb-5 flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-[13px] text-danger">
        <CircleAlert className="mt-0.5 size-4 shrink-0" /> {saveError}
      </p>}

      {error && <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
        <span className="flex size-11 items-center justify-center rounded-[10px] bg-danger-soft text-danger"><CircleAlert className="size-5" /></span>
        <p className="mt-4 text-sm font-bold text-ink">Models couldn't be loaded</p>
        <p className="mt-1 max-w-sm text-xs text-ink-muted">{error}</p>
        <Button variant="secondary" size="sm" className="mt-5" disabled={refreshing} onClick={onRetry}>
          <RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} /> Try again
        </Button>
      </div>}

      {!catalog && !error && <div className="space-y-3 animate-pulse-soft">
        {[0, 1, 2].map((index) => <div key={index} className="h-16 rounded-xl bg-surface-2" />)}
      </div>}

      {catalog && <div className="divide-y divide-line">
        {MODEL_PURPOSES.map((purpose) => <ModelPurposeSection key={purpose.id} accountId={connection.id} purpose={purpose}
          catalog={catalog} choice={defaults[purpose.id]} disabled={saving} onChange={(choice) => onChange(purpose.id, choice)} />)}
      </div>}
    </div>
  </Card>;
};
