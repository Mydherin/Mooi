import { GithubAccountGroup } from '@/features/github/components/GithubAccountGroup';
import { GithubGateCard } from '@/features/github/components/GithubGateCard';
import { useGithubConnection } from '@/features/github/hooks/useGithubConnection';
import { Button } from '@/shared/components/actions/Button';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { Alert } from '@/shared/components/feedback/Alert';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';

const LoadingGroup = () => (
  <ListGroup title="Linked account">
    <li className="flex min-h-13 items-center gap-3 bg-surface px-4 py-2.5">
      <Skeleton className="size-9 rounded-full" />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-48 max-w-full" />
      </span>
    </li>
  </ListGroup>
);

/**
 * The live GitHub integration on the account screen. Every state it can be in is rendered here —
 * loading, linked, not linked, broken — because the player must never be left guessing whether an
 * account they authorized is actually connected.
 */
export const GithubConnectionPanel = () => {
  const { connection, status, error, manageAccess, disconnect, reload } = useGithubConnection();
  const busy = status === 'loading' || status === 'connecting';

  const failure = status === 'error' ? error ?? 'Something went wrong with GitHub.' : null;

  if (failure && !connection) {
    return <ErrorState title="GitHub is unavailable" description={failure} onRetry={reload} />;
  }

  if (connection) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {failure ? <Alert tone="danger" action={<Button variant="ghost" size="sm" onClick={reload}>Try again</Button>}>{failure}</Alert> : null}
        <GithubAccountGroup connection={connection} busy={busy} onManageAccess={manageAccess} onDisconnect={disconnect} />
      </div>
    );
  }

  if (status === 'ready' || status === 'connecting') {
    return (
      <GithubGateCard title="Link your GitHub account"
        description="Mooi lists your repositories, public and private, and commits as you. You can unlink it at any time." />
    );
  }

  return <LoadingGroup />;
};
