import { authenticatedFetch } from '@/features/auth/lib/authenticatedFetch';
import type { AuthPlayer } from '@/features/auth/types/AuthPlayer';
import type { CurrentPlayerResponse } from '@/features/auth/types/CurrentPlayerResponse';

export const fetchCurrentPlayer = async (): Promise<AuthPlayer> => {
  const response = await authenticatedFetch('/me');

  if (!response.ok) {
    throw new Error(`Request to /me failed with ${response.status}`);
  }

  const body = (await response.json()) as CurrentPlayerResponse;

  return body.player;
};
