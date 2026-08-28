import { Settings2 } from 'lucide-react';
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
  <Card className="p-6 lg:col-span-2">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <Avatar src={player.avatarUrl} name={player.username} size="lg" />

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xl font-semibold tracking-tight text-ink">
          {player.username}
        </h2>
        <p className="mt-1 truncate text-sm text-ink-muted">{player.email}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={player.role === 'admin' ? 'brand' : 'neutral'} className="capitalize">
            {player.role}
          </Badge>
          <span className="text-xs text-ink-subtle">
            Member since {formatDate(player.createdAt)}
          </span>
        </div>
      </div>

      <Button variant="ghost" size="sm">
        <Settings2 className="size-4" />
        Edit profile
      </Button>
    </div>
  </Card>
);
