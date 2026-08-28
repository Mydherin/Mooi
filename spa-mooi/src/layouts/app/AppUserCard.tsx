import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import type { AuthPlayer } from '@/features/auth/types/AuthPlayer';
import { Avatar } from '@/shared/components/Avatar';
import { Badge } from '@/shared/components/Badge';

interface AppUserCardProps {
  player: AuthPlayer;
  onNavigate?: () => void;
}

export const AppUserCard = ({ player, onNavigate }: AppUserCardProps) => (
  <Link
    to={ROUTES.account}
    onClick={onNavigate}
    className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
  >
    <Avatar src={player.avatarUrl} name={player.username} size="md" />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium text-ink">{player.username}</span>
      <Badge tone={player.role === 'admin' ? 'brand' : 'neutral'} className="mt-1 capitalize">
        {player.role}
      </Badge>
    </span>
    <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
  </Link>
);
