import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { AdminPlayer } from '@/features/admin/types/AdminPlayer';
import { Avatar } from '@/shared/components/data-display/Avatar';
import { Badge } from '@/shared/components/data-display/Badge';
import { StatusDot } from '@/shared/components/data-display/StatusDot';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';

interface AdminUserRowProps {
  player: AdminPlayer;
  devices: number;
  lastSeenAt: string | null;
  sessions: number;
  working: number;
  onOpen: (id: string) => void;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * One user of the directory, stacked so the name and email keep the width on phones: presence on
 * the avatar, role and ban as badges, then what they do now (sessions, agents working, projects).
 */
export const AdminUserRow = memo(({ player, devices, lastSeenAt, sessions, working, onOpen }: AdminUserRowProps) => (
  <li className="min-w-0">
    <button type="button" onClick={() => onOpen(player.id)}
      className="flex min-h-16 w-full min-w-0 items-center gap-3 bg-surface px-4 py-3 text-left transition-colors duration-100 outline-none active:bg-surface-2 hover-device:hover:bg-surface-2/60 focus-visible:bg-surface-2">
      <span className="relative shrink-0">
        <Avatar src={player.avatarUrl} name={player.username} />
        {devices > 0 ? <span aria-hidden className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface bg-success-dot" /> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-body font-medium text-ink">{player.username}</span>
          {player.role === 'admin' ? <Badge tone="accent" className="shrink-0">Admin</Badge> : null}
          {player.bannedAt ? <Badge tone="danger" className="shrink-0">Banned</Badge> : null}
        </span>
        <span className="mt-0.5 block truncate text-footnote text-ink-subtle">{player.email}</span>
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-footnote text-ink-muted">
          {devices > 0 ? (
            <span className="font-medium text-success">Online{devices > 1 ? ` · ${devices} devices` : ''}</span>
          ) : (
            <span>{lastSeenAt ? `Seen ${formatRelativeTime(lastSeenAt)}` : 'Never signed in'}</span>
          )}
          {sessions > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={working > 0 ? 'info' : 'success'} pulse={working > 0} />
              {plural(sessions, 'session')}{working > 0 ? ` · ${working} working` : ''}
            </span>
          ) : null}
          <span className="tabular-nums">{plural(player.projects, 'project')}</span>
        </span>
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-line-strong" />
    </button>
  </li>
));

AdminUserRow.displayName = 'AdminUserRow';
