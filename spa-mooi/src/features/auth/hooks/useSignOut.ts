import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { signOut, signOutEverywhere } from '@/features/auth/lib/signOut';

interface UseSignOut {
  busy: boolean;
  signOutHere: () => void;
  signOutFromEveryDevice: () => void;
}

/**
 * Signing out, wherever the control that triggers it happens to live.
 *
 * It ends on the login screen every time: the application has no signed-out surface, so leaving the
 * player on the screen they were reading would show them a shell with nothing behind it.
 */
export const useSignOut = (): UseSignOut => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    (action: () => Promise<void>) => {
      setBusy(true);
      void action().then(() => navigate(ROUTES.login, { replace: true }));
    },
    [navigate],
  );

  return {
    busy,
    signOutHere: useCallback(() => run(signOut), [run]),
    signOutFromEveryDevice: useCallback(() => run(signOutEverywhere), [run]),
  };
};
