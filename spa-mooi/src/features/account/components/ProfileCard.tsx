import type { AuthPlayer } from '@/features/auth/types/AuthPlayer';
import { Avatar } from '@/shared/components/Avatar';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { formatDate } from '@/shared/utils/formatDate';

interface ProfileCardProps {
  player: AuthPlayer;
}

export const ProfileCard = ({ player }: ProfileCardProps) => (
  <Card className="p-5 sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Avatar src={player.avatarUrl} name={player.username} size="lg" />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2.5">
          <span className="truncate text-[26px] font-extrabold tracking-[-0.035em] text-ink">
            {player.username}
          </span>
          <Badge tone={player.role === 'admin' ? 'brand' : 'neutral'} className="capitalize">
            {player.role}
          </Badge>
        </p>

        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
          <span className="truncate">{player.email}</span>
          <span aria-hidden className="text-line-strong">·</span>
          <span className="text-ink-subtle">On Mooi since {formatDate(player.createdAt)}</span>
        </p>
      </div>

      <span className="shrink-0">
        <Button variant="secondary" size="sm" disabled>
          Edit profile
        </Button>
      </span>
    </div>

    <p className="mt-5 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-subtle">
      <span className="font-bold text-ink-muted">
        Name, email and avatar come from your Google identity.
      </span>{' '}
      Editing is announced but not operational: they cannot be changed from the platform today.
    </p>
  </Card>
);
