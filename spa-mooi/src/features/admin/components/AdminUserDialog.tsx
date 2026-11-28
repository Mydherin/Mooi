import { useEffect, useState } from 'react';
import { Ban, LogOut, MonitorSmartphone, ShieldCheck, Square, SquareX } from 'lucide-react';
import {
  closeAdminSession, closePlayerSessions, fetchPlayerSignIns, setPlayerBanned, signOutPlayer,
} from '@/features/admin/api/adminApi';
import { deviceLabel } from '@/features/admin/lib/adminActivity';
import type { AdminPlayer } from '@/features/admin/types/AdminPlayer';
import type { AdminSession } from '@/features/admin/types/AdminSession';
import type { AdminSignIn } from '@/features/admin/types/AdminSignIn';
import { sessionDisplayStatus } from '@/features/sessions/lib/sessionDisplayStatus';
import { sessionStatusLabel, sessionStatusPulses, sessionStatusTone } from '@/features/sessions/lib/sessionStatusTone';
import { Button } from '@/shared/components/actions/Button';
import { IconButton } from '@/shared/components/actions/IconButton';
import { Avatar } from '@/shared/components/data-display/Avatar';
import { Badge } from '@/shared/components/data-display/Badge';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { ListRow } from '@/shared/components/data-display/ListRow';
import { Stat } from '@/shared/components/data-display/Stat';
import { StatusDot } from '@/shared/components/data-display/StatusDot';
import { Alert } from '@/shared/components/feedback/Alert';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { ConfirmDialog } from '@/shared/components/overlays/confirm/ConfirmDialog';
import { Dialog } from '@/shared/components/overlays/dialog/Dialog';
import { formatDate } from '@/shared/utils/formatDate';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';

interface AdminUserDialogProps {
  player: AdminPlayer;
  devices: number;
  lastSeenAt: string | null;
  sessions: AdminSession[];
  /** The administrator looking at their own account: no signing out or banning themselves. */
  self: boolean;
  onChange: (change: Partial<AdminPlayer>) => void;
  onClose: () => void;
}

type Action = 'close' | 'signOut' | 'ban' | 'unban' | `session:${string}`;

const Empty = ({ children }: { children: string }) => (
  <li className="bg-surface px-4 py-3.5 text-callout text-ink-subtle">{children}</li>
);

/**
 * One user in depth: what they are doing now, their devices and the account actions (as rows, so
 * none is clipped on a phone). Live chats follow the administrators' channel, so a closed chat
 * leaves this list on its own.
 */
export const AdminUserDialog = ({ player, devices, lastSeenAt, sessions, self, onChange, onClose }: AdminUserDialogProps) => {
  const [signIns, setSignIns] = useState<AdminSignIn[] | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmBan, setConfirmBan] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPlayerSignIns(player.id).then((values) => { if (!cancelled) setSignIns(values); })
      .catch((failure: Error) => { if (!cancelled) setError(failure.message); });
    return () => { cancelled = true; };
  }, [player.id]);

  const run = (action: Action, work: () => Promise<void>) => {
    setBusy(action);
    setError(null);
    work().catch((failure: Error) => setError(failure.message)).finally(() => setBusy(null));
  };

  const signedOut = () => {
    setSignIns([]);
    onChange({ signIns: 0 });
  };

  const ban = () => run('ban', async () => {
    const bannedAt = await setPlayerBanned(player.id, true);
    setConfirmBan(false);
    signedOut();
    onChange({ bannedAt });
    // A suspended account keeps no agent running on the platform's accounts.
    if (sessions.length > 0) await closePlayerSessions(player.id);
  });

  return (
    <>
      <Dialog open onClose={onClose} title={player.username} description={player.email} size="lg" dismissible={busy === null}
        footer={<Button variant="secondary" onClick={onClose} disabled={busy !== null}>Done</Button>}>
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar src={player.avatarUrl} name={player.username} size="lg" />
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {devices > 0 ? <Badge tone="success">Online{devices > 1 ? ` · ${devices} devices` : ''}</Badge>
                  : <Badge>{lastSeenAt ? `Seen ${formatRelativeTime(lastSeenAt)}` : 'Never seen'}</Badge>}
                {player.role === 'admin' ? <Badge tone="accent">Admin</Badge> : null}
                {player.bannedAt ? <Badge tone="danger">Banned {formatRelativeTime(player.bannedAt)}</Badge> : null}
              </div>
              <p className="text-footnote text-ink-subtle">Joined {formatDate(player.createdAt)}</p>
            </div>
          </div>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Projects" value={player.projects} />
            <Stat label="Agent accounts" value={player.agentAccounts} />
            <Stat label="GitHub" value={player.githubLinked ? 'Linked' : 'No'} />
            <Stat label="Devices" value={signIns?.length ?? player.signIns} />
          </div>

          <ListGroup title={`Live sessions · ${sessions.length}`}>
            {sessions.length === 0 ? <Empty>No live session right now.</Empty> : sessions.map((session) => {
              const display = sessionDisplayStatus(session.status, session.deploymentState);
              const action: Action = `session:${session.id}`;
              return (
                <ListRow key={session.id}
                  leading={<StatusDot tone={sessionStatusTone(display)} pulse={sessionStatusPulses(display)} />}
                  title={<>{session.projectFullName}<span className="font-normal text-ink-subtle"> · {session.kind === 'session' ? session.branch : session.kind}</span></>}
                  subtitle={`${session.pending ? 'Waiting for an answer' : sessionStatusLabel(display)} · ${session.providerLabel} ${session.adapterLabel} · ${session.model}${session.effort ? ` · ${session.effort}` : ''} · ${formatRelativeTime(session.updatedAt)}`}
                  trailing={<IconButton icon={Square} label="Close session" disabled={busy !== null} loading={busy === action}
                    onClick={() => run(action, () => closeAdminSession(session.id))} />} />
              );
            })}
          </ListGroup>

          <ListGroup title="Signed-in devices">
            {signIns === null ? (
              <li className="flex items-center gap-3 bg-surface px-4 py-3"><Skeleton className="h-4 w-48 max-w-full" /></li>
            ) : signIns.length === 0 ? <Empty>Not signed in anywhere.</Empty> : signIns.map((signIn) => (
              <ListRow key={signIn.id} leading={<MonitorSmartphone aria-hidden className="size-5 text-ink-subtle" />}
                title={deviceLabel(signIn.userAgent)}
                subtitle={`${signIn.ipAddress ?? 'Unknown address'} · signed in ${formatDate(signIn.createdAt)}`}
                trailing={<span className="text-footnote">{formatRelativeTime(signIn.lastUsedAt)}</span>} />
            ))}
          </ListGroup>

          <ListGroup title="Account actions" footer={self ? 'You cannot sign yourself out or ban yourself from here.' : undefined}>
            <ListRow title={busy === 'close' ? 'Closing sessions…' : 'Close sessions'} leading={<SquareX aria-hidden className="size-5 text-ink-muted" />}
              disabled={busy !== null || sessions.length === 0}
              onClick={() => run('close', async () => { await closePlayerSessions(player.id); })} />
            <ListRow title={busy === 'signOut' ? 'Signing out…' : 'Sign out everywhere'} leading={<LogOut aria-hidden className="size-5 text-ink-muted" />}
              disabled={busy !== null || self || player.signIns === 0}
              onClick={() => run('signOut', async () => { await signOutPlayer(player.id); signedOut(); })} />
            {player.bannedAt ? (
              <ListRow title={busy === 'unban' ? 'Restoring…' : 'Unban'} leading={<ShieldCheck aria-hidden className="size-5 text-success" />}
                disabled={busy !== null}
                onClick={() => run('unban', async () => { onChange({ bannedAt: await setPlayerBanned(player.id, false) }); })} />
            ) : (
              <ListRow title={`Ban ${player.username}`} destructive leading={<Ban aria-hidden className="size-5 text-danger" />}
                disabled={busy !== null || self} onClick={() => setConfirmBan(true)} />
            )}
          </ListGroup>
        </div>
      </Dialog>

      <ConfirmDialog open={confirmBan} onClose={() => setConfirmBan(false)} onConfirm={ban} busy={busy === 'ban'} tone="danger"
        title={`Ban ${player.username}?`} confirmLabel="Ban"
        description={`It signs ${player.username} out of every device, closes their sessions and blocks new sign-ins until you unban them.`} />
    </>
  );
};
