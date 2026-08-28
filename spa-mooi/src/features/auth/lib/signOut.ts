import { logout, logoutEverywhere } from '@/features/auth/api/authApi';
import { getAccessToken } from '@/features/auth/lib/accessTokenProvider';
import { useAuthStore } from '@/stores/authStore';

/** Ends the local session first, then tells the server. The button always wins. */
export const signOut = async (): Promise<void> => {
  const session = useAuthStore.getState().session;

  useAuthStore.getState().clear();

  if (session) {
    await logout(session.refreshToken).catch(() => {});
  }
};

/** Revokes every session for the player, including this one. */
export const signOutEverywhere = async (): Promise<void> => {
  const token = await getAccessToken();

  useAuthStore.getState().clear();

  if (token) {
    await logoutEverywhere(token).catch(() => {});
  }
};
