/** Where a server-read list is in its lifecycle. `ready` covers an empty list: nothing linked is a state, not a failure. */
export type RecipesStatus = 'idle' | 'loading' | 'ready' | 'error';
