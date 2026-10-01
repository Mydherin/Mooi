import type { ReactNode } from 'react';

/** What a platform chat shows above the conversation once the agent is idle. */
export interface PlatformCompletion {
  /** True once its job is done (success check); false for a plain ready notice. */
  done: boolean;
  title: string;
  description: string;
  action: ReactNode;
}
