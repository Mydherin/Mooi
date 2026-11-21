import type { FactoryIssue } from '@/features/factory/types/FactoryIssue';
import type { FactoryPhase } from '@/features/factory/types/FactoryPhase';

/** The plan Mooi last read from `docs/factory/` on the default branch. */
export interface FactoryPlan {
  /** Which core documents exist, by file name. */
  core: Record<string, boolean>;
  issues: FactoryIssue[];
  phases: FactoryPhase[];
}
