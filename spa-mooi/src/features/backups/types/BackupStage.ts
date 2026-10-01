/** Where the project stands in the backup lifecycle, derived from the overview, the live operation and the list. */
export type BackupStage = 'undeployed' | 'unconfigured' | 'preparing' | 'ready' | 'running' | 'protected' | 'failed';
