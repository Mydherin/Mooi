import type { MergeState } from './MergeState';

export interface MergeResult {
  state: MergeState;
  targetBranch: string;
  conflicts: string[];
  commit: string | null;
}
