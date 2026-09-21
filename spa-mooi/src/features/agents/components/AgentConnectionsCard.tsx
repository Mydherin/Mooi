import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AgentProviderRow } from '@/features/agents/components/AgentProviderRow';
import { AgentTokenDialog } from '@/features/agents/components/AgentTokenDialog';
import { useAgentConnections } from '@/features/agents/hooks/useAgentConnections';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';

const Skeleton = () => (
  <ul className="mt-5 flex animate-pulse-soft flex-col gap-4">
    {[0, 1].map((row) => (
      <li key={row} className="flex items-center gap-3">
        <span className="size-9 shrink-0 rounded-xl bg-surface-2" />
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="h-3.5 w-32 rounded-full bg-surface-2" />
          <span className="h-3 w-48 rounded-full bg-surface-2" />
        </span>
      </li>
    ))}
  </ul>
);

/**
 * The agent providers Mooi can start sessions with, and their connection state on the account
 * screen. Every provider is listed even before it is linked, so a player knows what is available
 * before ever creating a session.
 */
export const AgentConnectionsCard = () => {
  const { providers, connections, status, error, busy, actionError, startOauth, connectToken, disconnect, reload, clearActionError } =
    useAgentConnections();
  const [tokenDialogProvider, setTokenDialogProvider] = useState<string | null>(null);

  const dialogProvider = providers.find((provider) => provider.id === tokenDialogProvider) ?? null;

  const openConnect = (provider: (typeof providers)[number]) => {
    if (provider.oauthEnabled) {
      startOauth(provider.id);
    } else {
      clearActionError();
      setTokenDialogProvider(provider.id);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-sm font-extrabold tracking-[-0.02em] text-ink">Agents</h2>

      {status === 'error' ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">
            {error}
          </p>
          <span className="shrink-0">
            <Button variant="secondary" size="sm" onClick={reload}>
              <RefreshCw className="size-4" />
              Try again
            </Button>
          </span>
        </div>
      ) : null}

      {status !== 'error' && status !== 'ready' && providers.length === 0 ? <Skeleton /> : null}

      {status !== 'error' && providers.length > 0 ? (
        <ul className="mt-5 divide-y divide-line">
          {providers.map((provider) => (
            <AgentProviderRow
              key={provider.id}
              provider={provider}
              connection={connections.find((connection) => connection.provider === provider.id) ?? null}
              busy={busy}
              onConnect={() => openConnect(provider)}
              onDisconnect={() => void disconnect(provider.id)}
            />
          ))}
        </ul>
      ) : null}

      {actionError && !dialogProvider ? (
        <p className="mt-4 rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {actionError}
        </p>
      ) : null}

      <AgentTokenDialog
        open={dialogProvider !== null}
        providerLabel={dialogProvider?.label ?? ''}
        busy={busy}
        actionError={dialogProvider ? actionError : null}
        onClose={() => setTokenDialogProvider(null)}
        onSubmit={(token) => connectToken(dialogProvider?.id ?? '', token)}
      />
    </Card>
  );
};
