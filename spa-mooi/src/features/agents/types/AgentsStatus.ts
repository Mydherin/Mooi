/** Where the agent providers and connections are in their lifecycle. `ready` covers no connection at all: not linked is a state, not a failure. */
export type AgentsStatus = 'idle' | 'loading' | 'ready' | 'error';
