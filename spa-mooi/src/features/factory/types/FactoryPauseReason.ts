/** Why a paused factory stopped: only `limits` resumes by itself. */
export type FactoryPauseReason = 'user' | 'limits' | 'attention' | 'revoked' | 'error';
