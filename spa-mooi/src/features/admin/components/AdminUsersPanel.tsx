import { useCallback, useMemo, useState } from 'react';
import { Activity, Bot, MessagesSquare, RefreshCw, Users } from 'lucide-react';
import { AdminUserDialog } from '@/features/admin/components/AdminUserDialog';
import { AdminUserRow } from '@/features/admin/components/AdminUserRow';
import { useAdminLive } from '@/features/admin/hooks/useAdminLive';
import { useAdminPlayers } from '@/features/admin/hooks/useAdminPlayers';
import { isWorking, lastSeen } from '@/features/admin/lib/adminActivity';
import type { AdminSession } from '@/features/admin/types/AdminSession';
import { Button } from '@/shared/components/actions/Button';
import { IconButton } from '@/shared/components/actions/IconButton';
import { CompactNumber } from '@/shared/components/data-display/CompactNumber';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { Stat } from '@/shared/components/data-display/Stat';
import { StatusDot } from '@/shared/components/data-display/StatusDot';
import { Alert } from '@/shared/components/feedback/Alert';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { SearchInput } from '@/shared/components/forms/SearchInput';
import { PageSection } from '@/shared/components/layout/PageSection';
import { cn } from '@/shared/utils/cn';
import { formatCount } from '@/shared/utils/formatCount';
import { useAuthStore } from '@/stores/authStore';

/**
 * Every registered user, the connected ones first, with what they are doing right now. The
 * directory pages through mic-mooi; presence and live sessions stream from mic-sessions.
 */
export const AdminUsersPanel = () => {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const selfId = useAuthStore((state) => state.player?.id);
  const directory = useAdminPlayers(query);
  const live = useAdminLive();
  const open = useCallback((id: string) => setOpenId(id), []);

  const sessionsByPlayer = useMemo(() => {
    const grouped = new Map<string, AdminSession[]>();
    for (const session of Object.values(live.sessions)) {
      const list = grouped.get(session.playerId);
      if (list) list.push(session);
      else grouped.set(session.playerId, [session]);
    }
    for (const list of grouped.values()) list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return grouped;
  }, [live.sessions]);

  // Connected users first; otherwise the directory's own order (most recently active first).
  const players = useMemo(() => {
    const online = (id: string) => (live.presence[id] ?? 0) > 0;
    return [...directory.players].sort((a, b) => Number(online(b.id)) - Number(online(a.id)));
  }, [directory.players, live.presence]);

  const sessions = Object.values(live.sessions);
  const online = Object.keys(live.presence).length;
  const working = sessions.filter(isWorking).length;
  const waiting = sessions.filter((session) => session.pending || session.status === 'waiting').length;
  const openPlayer = openId ? directory.players.find((player) => player.id === openId) : undefined;
  const streaming = live.streamState === 'open';

  return (
    <>
      <PageSection>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Users} label="Users" value={<CompactNumber value={directory.total} />} />
          <Stat icon={Activity} label="Online now" value={<CompactNumber value={online} />} tone={online > 0 ? 'success' : undefined} />
          <Stat icon={MessagesSquare} label="Live sessions" value={<CompactNumber value={sessions.length} />}
            hint={waiting > 0 ? `${formatCount(waiting)} waiting` : undefined} />
          <Stat icon={Bot} label="Agents working" value={<CompactNumber value={working} />} tone={working > 0 ? 'info' : undefined} />
        </div>
      </PageSection>

      <PageSection title="Users"
        actions={(
          <>
            <span role="status" className="inline-flex items-center gap-1.5 text-footnote text-ink-muted">
              <StatusDot tone={streaming ? 'success' : 'warning'} pulse={streaming} />
              {streaming ? 'Live' : 'Reconnecting'}
            </span>
            <IconButton icon={RefreshCw} label="Reload users" onClick={directory.reload} loading={directory.loading} />
          </>
        )}>
        <SearchInput value={query} onChange={setQuery} placeholder="Name or email" className="mb-3" />

        {directory.error ? <Alert tone="danger" className="mb-3">{directory.error}</Alert> : null}

        {directory.loading && players.length === 0 ? (
          <ListGroup>
            {[0, 1, 2].map((index) => (
              <li key={index} className="flex min-h-16 items-center gap-3 bg-surface px-4 py-3">
                <Skeleton className="size-9 rounded-full" />
                <span className="flex min-w-0 flex-1 flex-col gap-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-48 max-w-full" /></span>
              </li>
            ))}
          </ListGroup>
        ) : !directory.error && players.length === 0 ? (
          <EmptyState icon={Users} title={query ? 'No user matches' : 'No users yet'}
            description={query ? 'Try another name or email.' : 'Users appear here once they sign in.'} />
        ) : (
          <ListGroup className={cn('transition-opacity', directory.loading && 'opacity-60')}
            footer={directory.hasMore ? (
              <Button variant="ghost" size="sm" fullWidth loading={directory.loadingMore} onClick={directory.loadMore}>
                Show more ({formatCount(directory.total - directory.players.length)} left)
              </Button>
            ) : undefined}>
            {players.map((player) => {
              const own = sessionsByPlayer.get(player.id) ?? [];
              return (
                <AdminUserRow key={player.id} player={player} devices={live.presence[player.id] ?? 0}
                  lastSeenAt={lastSeen(player, live.offlineAt[player.id])} sessions={own.length}
                  working={own.filter(isWorking).length} onOpen={open} />
              );
            })}
          </ListGroup>
        )}
      </PageSection>

      {openPlayer ? (
        <AdminUserDialog key={openPlayer.id} player={openPlayer} devices={live.presence[openPlayer.id] ?? 0}
          lastSeenAt={lastSeen(openPlayer, live.offlineAt[openPlayer.id])}
          sessions={sessionsByPlayer.get(openPlayer.id) ?? []} self={openPlayer.id === selfId}
          onChange={(change) => directory.patch(openPlayer.id, change)} onClose={() => setOpenId(null)} />
      ) : null}
    </>
  );
};
