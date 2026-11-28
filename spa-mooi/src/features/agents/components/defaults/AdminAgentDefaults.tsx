import { RefreshCw } from 'lucide-react';
import { AgentDefaultsRow } from '@/features/agents/components/defaults/AgentDefaultsRow';
import { useEngineDefaults } from '@/features/agents/hooks/useEngineDefaults';
import { Button } from '@/shared/components/actions/Button';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { PageSection } from '@/shared/components/layout/PageSection';

/** The platform's agent defaults: what every new session preselects, per provider. */
export const AdminAgentDefaults = () => {
  const { defaults, providers, loading, error, catalog, loadCatalog, refresh, refreshing, save } = useEngineDefaults();
  const adapterOf = (provider: string, configured: string | null) => {
    const adapters = providers[provider]?.adapters ?? [];
    return adapters.find((entry) => entry.id === configured)?.id ?? adapters[0]?.id ?? '';
  };

  return (
    <PageSection title="Session defaults" description="Preselected for every user when a session starts. Changes save at once."
      actions={<Button variant="ghost" size="sm" icon={RefreshCw} onClick={refresh} loading={refreshing}>Models</Button>}>
      {error ? <ErrorState title="Defaults are unavailable" description={error} onRetry={() => window.location.reload()} /> : null}
      {loading ? (
        <div className="grid gap-4">
          {[0, 1].map((index) => <Skeleton key={index} className="h-56 rounded-card" />)}
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {defaults.map((entry) => (
            <AgentDefaultsRow key={entry.provider} defaults={entry} provider={providers[entry.provider]}
              catalog={catalog(entry.provider, adapterOf(entry.provider, entry.sessionAdapter))}
              loadCatalog={loadCatalog} save={save} />
          ))}
        </div>
      )}
    </PageSection>
  );
};
