import { Avatar } from '@/shared/components/data-display/Avatar';
import { Badge } from '@/shared/components/data-display/Badge';
import type { AuthPlayer } from '@/features/auth/types/AuthPlayer';

interface AccountSummaryProps {
  player: AuthPlayer;
}

/** Who is signed in: avatar, name, email and role, at the top of the account menu and the More sheet. */
export const AccountSummary = ({ player }: AccountSummaryProps) => (
  <div className="flex min-w-0 items-center gap-3 px-3 py-2.5">
    <Avatar src={player.avatarUrl} name={player.username} size="md" />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-callout font-semibold text-ink">{player.username}</span>
      <span className="block truncate text-footnote text-ink-subtle">{player.email}</span>
    </span>
    <Badge tone={player.role === 'admin' ? 'brand' : 'neutral'} className="capitalize">{player.role}</Badge>
  </div>
);
