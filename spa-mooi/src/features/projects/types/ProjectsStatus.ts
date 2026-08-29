/** Where the workspace project list is in its lifecycle. `ready` covers an empty list: having no project is a state, not a failure. */
export type ProjectsStatus = 'idle' | 'loading' | 'ready' | 'error';
