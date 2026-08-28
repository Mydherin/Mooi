import type { PlayerRole } from '@/features/auth/types/PlayerRole';

export interface AuthPlayer {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: PlayerRole;
  createdAt: string;
}
