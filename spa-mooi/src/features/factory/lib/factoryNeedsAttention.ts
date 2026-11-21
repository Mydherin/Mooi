import type { Factory } from '@/features/factory/types/Factory';

/** The factory waits for the user: a parked milestone, a scope change to confirm, a revoked sign-in or errors. */
export const factoryNeedsAttention = (factory: Factory | null | undefined): boolean =>
  factory?.status === 'paused' && (factory.pauseReason === 'attention' || factory.pauseReason === 'revoked'
    || factory.pauseReason === 'error');
