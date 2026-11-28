import { memo, useState } from 'react';
import { Bot, LogIn, Pencil, Star, StarOff, Unlink } from 'lucide-react';
import { AgentAccountLimit } from '@/features/agents/components/accounts/AgentAccountLimit';
import { AgentAccountRepairNotice } from '@/features/agents/components/accounts/AgentAccountRepairNotice';
import { accountName } from '@/features/agents/lib/accountName';
import { canSignInAgain, usesLegacyToken } from '@/features/agents/lib/agentAccountRepair';
import type { AgentAccountAction } from '@/features/agents/types/AgentAccountAction';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import type { AgentProvider } from '@/features/agents/types/AgentProvider';
import { Badge } from '@/shared/components/data-display/Badge';
import { TruncatedText } from '@/shared/components/data-display/TruncatedText';
import { Menu } from '@/shared/components/overlays/menu/Menu';
import { useLongPress } from '@/shared/gestures/useLongPress';
import { cn } from '@/shared/utils/cn';

interface AgentAccountRowProps {
  connection: AgentConnection;
  provider: AgentProvider | undefined;
  busy: boolean;
  onAction: (action: AgentAccountAction, connection: AgentConnection) => void;
}

/**
 * One linked provider account: its title gets the whole line (actions live in one menu, also on a
 * long press), with the provider, default choice, 5 hour limit and repair state underneath.
 */
export const AgentAccountRow = memo(({ connection, provider, busy, onAction }: AgentAccountRowProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const press = useLongPress(() => setMenuOpen(true), { enabled: !busy });
  const name = accountName(connection);
  const legacy = usesLegacyToken(connection, provider);
  const repairable = canSignInAgain(connection, provider);
  const act = (action: AgentAccountAction) => () => onAction(action, connection);

  return (
    <li className="min-w-0 bg-surface">
      <div {...press} className="flex min-h-16 min-w-0 items-center gap-3 py-2.5 pr-2 pl-4">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-control',
          connection.defaultAccount ? 'bg-brand-soft text-brand-strong' : 'bg-surface-2 text-ink-muted')}>
          <Bot aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <TruncatedText text={name} className="text-body font-medium text-ink" />
          <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-footnote text-ink-subtle">
            <span>{connection.label}</span>
            {connection.accountLabel && connection.accountLabel !== name ? <span className="min-w-0 truncate">· {connection.accountLabel}</span> : null}
            <AgentAccountLimit connectionId={connection.id} />
          </p>
          {connection.defaultAccount || connection.stale || legacy ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {connection.defaultAccount ? <Badge tone="brand" icon={Star}>Default</Badge> : null}
              {connection.stale ? <Badge tone="warning">Signed out</Badge> : null}
              {legacy ? <Badge tone="warning">Deprecated token</Badge> : null}
            </div>
          ) : null}
        </div>
        <Menu label={`${name} actions`} open={menuOpen} onOpenChange={setMenuOpen} sections={[
          { id: 'main', items: [
            { id: 'default', label: connection.defaultAccount ? 'Stop using by default' : 'Use by default',
              icon: connection.defaultAccount ? StarOff : Star, disabled: busy, onSelect: act('toggleDefault') },
            { id: 'rename', label: 'Rename', icon: Pencil, disabled: busy, onSelect: act('rename') },
            { id: 'sign-in', label: 'Sign in again', icon: LogIn, hidden: !repairable, disabled: busy, onSelect: act('signInAgain') },
          ] },
          { id: 'danger', items: [{ id: 'disconnect', label: 'Disconnect', icon: Unlink, destructive: true, disabled: busy, onSelect: act('disconnect') }] },
        ]} />
      </div>
      {connection.stale || legacy ? (
        <AgentAccountRepairNotice providerLabel={connection.label} stale={connection.stale} legacy={legacy}
          onSignInAgain={repairable ? act('signInAgain') : undefined} busy={busy} />
      ) : null}
    </li>
  );
});

AgentAccountRow.displayName = 'AgentAccountRow';
