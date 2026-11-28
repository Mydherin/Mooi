import { useEffect, useState } from 'react';
import { Bot, Plus } from 'lucide-react';
import { AddAgentAccountDialog } from '@/features/agents/components/accounts/AddAgentAccountDialog';
import { AgentAccountRow } from '@/features/agents/components/accounts/AgentAccountRow';
import { AgentSignInAgainDialog } from '@/features/agents/components/accounts/AgentSignInAgainDialog';
import { RenameAgentAccountDialog } from '@/features/agents/components/accounts/RenameAgentAccountDialog';
import { useAgentConnections } from '@/features/agents/hooks/useAgentConnections';
import { accountName } from '@/features/agents/lib/accountName';
import type { AgentAccountAction } from '@/features/agents/types/AgentAccountAction';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import { Button } from '@/shared/components/actions/Button';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { Alert } from '@/shared/components/feedback/Alert';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { ConfirmDialog } from '@/shared/components/overlays/confirm/ConfirmDialog';

type Pending = { action: Exclude<AgentAccountAction, 'toggleDefault'>; connection: AgentConnection } | null;

const LoadingRows = () => (
  <ListGroup title="Linked accounts">
    {[0, 1].map((index) => (
      <li key={index} className="flex min-h-16 items-center gap-3 bg-surface px-4 py-2.5">
        <Skeleton className="size-10 rounded-control" />
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3 w-24" />
        </span>
      </li>
    ))}
  </ListGroup>
);

/**
 * The provider accounts linked to this user: which one new sessions preselect, their 5 hour usage,
 * and adding, renaming, repairing or disconnecting them. Each action opens its own overlay.
 */
export const AgentAccountsPanel = () => {
  const { providers, connections, status, error, busy, actionError, connectToken,
    disconnect, rename, setDefaultAccount, reload, clearActionError } = useAgentConnections();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const close = () => setPending(null);

  // The list is loaded once per shell mount, and an installed app stays mounted for days: re-read it
  // whenever this panel is shown or comes back to the foreground, so an expired sign-in is visible here.
  useEffect(() => {
    reload();
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  const onAction = (action: AgentAccountAction, connection: AgentConnection) => {
    clearActionError();
    if (action === 'toggleDefault') void setDefaultAccount(connection.defaultAccount ? null : connection.id);
    else setPending({ action, connection });
  };

  const add = (
    <Button variant="tinted" size="sm" icon={Plus} disabled={busy || providers.length === 0}
      onClick={() => { clearActionError(); setAdding(true); }}>
      Add account
    </Button>
  );

  let content;
  if (status === 'error' && connections.length === 0) {
    content = <ErrorState title="Accounts are unavailable" description={error ?? 'The account list could not be loaded.'} onRetry={reload} />;
  } else if (status === 'loading' && connections.length === 0) {
    content = <LoadingRows />;
  } else if (connections.length === 0) {
    content = (
      <EmptyState icon={Bot} title="No agent accounts yet" description="Add a Claude or Codex account to start sessions with it.">
        {add}
      </EmptyState>
    );
  } else {
    content = (
      <ListGroup title="Linked accounts" action={add}
        footer="The default account is preselected for new sessions. Long press an account for its actions.">
        {connections.map((connection) => (
          <AgentAccountRow key={connection.id} connection={connection} busy={busy} onAction={onAction}
            provider={providers.find((entry) => entry.id === connection.provider)} />
        ))}
      </ListGroup>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {actionError && !adding && !pending ? <Alert tone="danger">{actionError}</Alert> : null}
      {content}

      {adding ? (
        <AddAgentAccountDialog providers={providers} busy={busy} actionError={actionError}
          onClose={() => setAdding(false)} onConnected={reload} onConnectToken={connectToken} />
      ) : null}

      {pending?.action === 'rename' ? (
        <RenameAgentAccountDialog key={pending.connection.id} connection={pending.connection} busy={busy}
          error={actionError} onClose={close}
          onRename={(id, name) => { void rename(id, name).then((done) => { if (done) close(); }); }} />
      ) : null}

      <AgentSignInAgainDialog connection={pending?.action === 'signInAgain' ? pending.connection : null}
        onClose={close} onConnected={() => { close(); reload(); }} />

      <ConfirmDialog open={pending?.action === 'disconnect'} onClose={close} tone="danger" busy={busy}
        title={pending ? `Disconnect ${accountName(pending.connection)}?` : 'Disconnect account?'} confirmLabel="Disconnect"
        description="Sessions started with it keep their history but cannot continue until you pick another account."
        error={pending?.action === 'disconnect' ? actionError : null}
        onConfirm={() => { if (pending) void disconnect(pending.connection.id).then((done) => { if (done) close(); }); }} />
    </div>
  );
};
