import type { Session } from '@/features/sessions/types/Session';
import { useAgentsStore } from '@/stores/agentsStore';

interface SessionAccountIdentityProps {
  session: Session;
  compact?: boolean;
}

/** The selected account is the primary identity; the provider explains its type. `compact` is one line. */
export const SessionAccountIdentity = ({ session, compact = false }: SessionAccountIdentityProps) => {
  const connection = useAgentsStore((state) => state.connections.find((item) => item.id === session.connectionId));
  const loading = useAgentsStore((state) => state.status === 'idle' || state.status === 'loading');
  const name = connection?.name?.trim() || connection?.accountLabel?.trim() || connection?.label || (loading ? 'Loading account…' : 'Account unavailable');

  if (compact) {
    return (
      <span className="block truncate text-[11px] leading-tight text-ink-subtle" title={`${name} · ${session.providerLabel}`}>
        <span className="font-bold text-ink-muted">{name}</span> · {session.providerLabel}
      </span>
    );
  }

  return (
    <span className="flex min-w-0 flex-col leading-tight" title={`${name} · ${session.providerLabel}`}>
      <span className="truncate text-xs font-bold text-ink">{name}</span>
      <span className="truncate text-[11px] text-ink-subtle">{session.providerLabel}</span>
    </span>
  );
};
