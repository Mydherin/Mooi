import { useEffect } from 'react';
import { fetchCurrentPlayer } from '@/features/auth/api/currentPlayerApi';
import { useAuthStore } from '@/stores/authStore';

/**
 * Re-checks the session on mount and whenever the tab regains focus, so a tab
 * revoked elsewhere drops to the login screen the moment it is looked at again.
 */
export const useSessionSync = (): void => {
  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      if (!useAuthStore.getState().session) {
        return;
      }

      fetchCurrentPlayer()
        .then((player) => {
          if (!cancelled) {
            useAuthStore.getState().setPlayer(player);
          }
        })
        .catch(() => {
          if (!cancelled) {
            useAuthStore.getState().clear();
          }
        });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        sync();
      }
    };

    sync();
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
};
