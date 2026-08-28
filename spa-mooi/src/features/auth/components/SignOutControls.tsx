import { useState } from 'react';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { signOut, signOutEverywhere } from '@/features/auth/lib/signOut';
import { Button } from '@/shared/components/Button';

export const SignOutControls = () => {
  const navigate = useNavigate();
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    await action();
    navigate(ROUTES.login, { replace: true });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button variant="secondary" disabled={busy} onClick={() => void run(signOut)}>
        <LogOut className="size-4" />
        Log out
      </Button>

      <Button
        variant={confirmAll ? 'danger' : 'secondary'}
        disabled={busy}
        onClick={() => {
          if (confirmAll) {
            void run(signOutEverywhere);
          } else {
            setConfirmAll(true);
          }
        }}
      >
        <MonitorSmartphone className="size-4" />
        {confirmAll ? 'Confirm — all devices' : 'All devices'}
      </Button>
    </div>
  );
};
