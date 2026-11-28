import { useState } from 'react';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { ListRow } from '@/shared/components/data-display/ListRow';
import { ConfirmDialog } from '@/shared/components/overlays/confirm/ConfirmDialog';

/** The two ways out: this device, or every device at once (confirmed first, it cannot be undone). */
export const SignOutGroup = () => {
  const { busy, signOutHere, signOutFromEveryDevice } = useSignOut();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <ListGroup title="Sign out" footer="Signed-in devices stay signed in while you use them, for 30 days without use at most.">
        <ListRow title="Log out on this device" leading={<LogOut aria-hidden className="size-5 text-ink-muted" />}
          onClick={signOutHere} disabled={busy} />
        <ListRow title="Log out on every device" destructive leading={<MonitorSmartphone aria-hidden className="size-5 text-danger" />}
          onClick={() => setConfirming(true)} disabled={busy} />
      </ListGroup>

      <ConfirmDialog open={confirming} onClose={() => setConfirming(false)} onConfirm={signOutFromEveryDevice} busy={busy}
        tone="danger" title="Log out on every device?" confirmLabel="Log out everywhere"
        description="Every phone, tablet and computer signed in to your account will have to sign in again, this one included." />
    </>
  );
};
