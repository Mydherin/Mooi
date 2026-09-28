/** `idle` means no deployment has run for the project since mic-sessions started. */
export type ProductionRunState = 'idle' | 'running' | 'succeeded' | 'failed';
