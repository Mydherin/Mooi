/** The last merge of the session into its target branch, folded from `merge.completed`. */
export interface MergeCompletion {
  targetBranch: string;
  commit: string;
  seq: number;
}
