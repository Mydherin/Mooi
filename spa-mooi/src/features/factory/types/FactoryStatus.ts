/** Where the factory's lifecycle stands; only `running` and `pausing` have sessions working. */
export type FactoryStatus = 'defining' | 'ready' | 'running' | 'pausing' | 'paused' | 'resting';
