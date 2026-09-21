import type { SessionEventType } from '@/features/sessions/types/SessionEventType';

export interface SessionEvent {
  seq: number;
  at: string;
  type: SessionEventType;
  data: Record<string, unknown>;
}
