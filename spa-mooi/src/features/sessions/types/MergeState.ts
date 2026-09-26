/** `clean`: ready to commit; `up_to_date`: the target already holds every change. */
export type MergeState = 'clean' | 'conflicts' | 'up_to_date' | 'merged';
