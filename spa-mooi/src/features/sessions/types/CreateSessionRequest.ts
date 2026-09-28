export interface CreateSessionRequest {
  projectId: string;
  provider: string;
  connectionId: string;
  model?: string;
  effort?: string | null;
  branch?: string;
  kind?: 'session' | 'production';
  /** Sent as the first user message as soon as the agent is ready. */
  initialMessage?: string;
}
