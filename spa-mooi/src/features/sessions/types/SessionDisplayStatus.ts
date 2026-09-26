import type { SessionStatus } from '@/features/sessions/types/SessionStatus';

/** What a session is doing right now, as shown to the player: its agent status or its deployment. */
export type SessionDisplayStatus = SessionStatus | 'deploying' | 'deployed';
