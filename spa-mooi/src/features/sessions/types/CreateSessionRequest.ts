import type { SessionKind } from '@/features/sessions/types/SessionKind';

export interface CreateSessionRequest {
  projectId: string;
  provider: string;
  connectionId: string;
  model?: string;
  effort?: string | null;
  branch?: string;
  kind?: SessionKind;
  /** Sent as the first user message as soon as the agent is ready. */
  initialMessage?: string;
}
