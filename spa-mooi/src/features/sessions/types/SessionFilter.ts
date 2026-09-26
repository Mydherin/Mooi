import type { LucideIcon } from 'lucide-react';
import type { Session } from '@/features/sessions/types/Session';
import type { SessionFilterId } from '@/features/sessions/types/SessionFilterId';

export interface SessionFilter {
  id: SessionFilterId;
  label: string;
  icon: LucideIcon;
  matches: (session: Session) => boolean;
}
