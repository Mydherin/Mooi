import type { AuthPlayer } from '@/features/auth/types/AuthPlayer';
import type { AuthSession } from '@/features/auth/types/AuthSession';

export interface AuthState {
  player: AuthPlayer | null;
  session: AuthSession | null;
  setSession: (player: AuthPlayer, session: AuthSession) => void;
  setPlayer: (player: AuthPlayer) => void;
  clear: () => void;
}
