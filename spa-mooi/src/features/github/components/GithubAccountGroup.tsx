import { useState } from 'react';
import { ExternalLink, FolderGit2, Unlink } from 'lucide-react';
import type { GithubConnection } from '@/features/github/types/GithubConnection';
import { Avatar } from '@/shared/components/data-display/Avatar';
import { Badge } from '@/shared/components/data-display/Badge';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { ListRow } from '@/shared/components/data-display/ListRow';
import { ConfirmDialog } from '@/shared/components/overlays/confirm/ConfirmDialog';
import { formatDate } from '@/shared/utils/formatDate';

interface GithubAccountGroupProps {
  connection: GithubConnection;
  busy: boolean;
  onManageAccess: () => void;
  onDisconnect: () => void;
}

const rowIcon = 'size-5 text-ink-muted';

/** The linked GitHub account, what it grants and the way to unlink it. */
export const GithubAccountGroup = ({ connection, busy, onManageAccess, onDisconnect }: GithubAccountGroupProps) => {
  const [confirming, setConfirming] = useState(false);
  const profileUrl = connection.profileUrl;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ListGroup title="Linked account">
        <ListRow leading={<Avatar src={connection.avatarUrl} name={connection.login} />}
          title={connection.login}
          subtitle={`${connection.name ? `${connection.name} · ` : ''}Linked ${formatDate(connection.connectedAt)}`}
          trailing={<Badge tone="success">Connected</Badge>} />
        {profileUrl ? (
          <ListRow title="Open GitHub profile" leading={<ExternalLink aria-hidden className={rowIcon} />} chevron
            onClick={() => window.open(profileUrl, '_blank', 'noopener,noreferrer')} />
        ) : null}
      </ListGroup>

      {/* Being linked and being able to read a repository are two different grants on GitHub, and
          a player who cannot find a private repository has no way to know that from the badge. */}
      <ListGroup title="Repositories" footer="Private repositories appear once Mooi is granted access to them on GitHub.">
        <ListRow title="Repository access" subtitle="Choose what Mooi can read on GitHub"
          leading={<FolderGit2 aria-hidden className={rowIcon} />} chevron onClick={onManageAccess} disabled={busy} />
      </ListGroup>

      <ListGroup footer="Projects stay in Mooi; sessions cannot reach GitHub until you link it again.">
        <ListRow title="Disconnect GitHub" destructive leading={<Unlink aria-hidden className="size-5 text-danger" />}
          onClick={() => setConfirming(true)} disabled={busy} />
      </ListGroup>

      <ConfirmDialog open={confirming} onClose={() => setConfirming(false)} tone="danger"
        title="Disconnect GitHub?" confirmLabel="Disconnect"
        description={`Mooi stops acting as ${connection.login}. Nothing changes on GitHub, and you can link it again at any time.`}
        onConfirm={() => { setConfirming(false); onDisconnect(); }} />
    </div>
  );
};
