import { Bot, TriangleAlert, Unlink } from 'lucide-react';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import type { AgentProvider } from '@/features/agents/types/AgentProvider';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { formatDate } from '@/shared/utils/formatDate';

interface AgentProviderRowProps {
  provider: AgentProvider;
  connection: AgentConnection | null;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

/**
 * One provider Mooi can run sessions with. Every state it can be in is a `Badge` rather than a
 * boolean: a stale OAuth grant is not the same as never having connected, and the player must be
 * able to tell them apart at a glance.
 */
export const AgentProviderRow = ({ provider, connection, busy, onConnect, onDisconnect }: AgentProviderRowProps) => (
  <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-ink-muted">
      <Bot className="size-4" />
    </span>

    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="truncate text-sm font-medium text-ink">{provider.label}</span>
        {connection && connection.stale ? (
          <Badge tone="warning" icon={TriangleAlert}>
            Needs attention
          </Badge>
        ) : connection ? (
          <Badge tone="success">Linked</Badge>
        ) : (
          <Badge tone="neutral">Not linked</Badge>
        )}
      </div>
      <p className="mt-1 truncate text-xs text-ink-subtle">
        {connection
          ? `${connection.accountLabel ? `${connection.accountLabel} · ` : ''}Linked ${formatDate(connection.connectedAt)}`
          : 'Link an account so sessions can run with this provider.'}
      </p>
    </div>

    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      {connection && connection.stale ? (
        <Button variant="secondary" size="sm" onClick={onConnect} disabled={busy}>
          Reconnect
        </Button>
      ) : null}

      {!connection ? (
        <Button variant="secondary" size="sm" onClick={onConnect} disabled={busy}>
          Connect
        </Button>
      ) : null}

      {connection ? (
        <Button variant="danger" size="sm" onClick={onDisconnect} disabled={busy}>
          <Unlink className="size-4" />
          Disconnect
        </Button>
      ) : null}
    </div>
  </li>
);
