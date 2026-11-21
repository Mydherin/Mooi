import type { FactoryStep } from '@/features/factory/types/FactoryStep';

/** Newest first; `hasMore` when older steps exist before the last one. */
export interface FactoryStepPage {
  steps: FactoryStep[];
  hasMore: boolean;
}
