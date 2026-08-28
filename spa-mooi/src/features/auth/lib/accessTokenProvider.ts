import { refreshSession } from '@/features/auth/api/authApi';
import { toAuthSession } from '@/features/auth/lib/toAuthSession';
import { useAuthStore } from '@/stores/authStore';

const RENEW_AHEAD_MS = 30_000;

let inFlight: Promise<string | null> | null = null;

const renew = async (presentedRefreshToken: string): Promise<string | null> => {
  const store = useAuthStore.getState();

  try {
    const response = await refreshSession(presentedRefreshToken);

    useAuthStore.getState().setSession(response.player, toAuthSession(response));

    return response.accessToken;
  } catch {
    const current = useAuthStore.getState().session;

    if (current && current.refreshToken !== presentedRefreshToken) {
      // Another tab rotated the token first; trust its fresher session.
      return current.accessToken;
    }

    store.clear();

    return null;
  }
};

export const getAccessToken = async (force = false): Promise<string | null> => {
  const session = useAuthStore.getState().session;

  if (!session) {
    return null;
  }

  if (!force && Date.now() < session.expiresAt - RENEW_AHEAD_MS) {
    return session.accessToken;
  }

  if (!inFlight) {
    inFlight = renew(session.refreshToken).finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
};
