/** Client-side flow of the merge control, from the first click to its outcome. */
export type MergePhase = 'idle' | 'checking' | 'ready' | 'merging' | 'merged' | 'up_to_date' | 'conflicts' | 'resolving';
