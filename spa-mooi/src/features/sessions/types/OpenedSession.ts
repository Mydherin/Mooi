/** A session the agent opened during a turn, as its `session.opened` event recorded it. */
export interface OpenedSession {
  sessionId: string;
  branch: string;
  title: string | null;
  /** The new session's first message, written by the agent that opened it. */
  prompt: string;
}
