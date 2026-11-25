import type { SessionKind } from '@/features/sessions/types/SessionKind';

export interface CreateSessionRequest {
  projectId: string;
  provider: string;
  /** The provider's adapter; the provider's default when omitted. */
  adapter?: string;
  connectionId: string;
  model?: string;
  effort?: string | null;
  /** Context handover percent; the platform's default when omitted, `null` turns it off. */
  contextHandover?: number | null;
  branch?: string;
  kind?: SessionKind;
  /** Sent as the first user message as soon as the agent is ready. */
  initialMessage?: string;
}
