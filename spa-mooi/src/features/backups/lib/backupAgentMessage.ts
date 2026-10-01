import type { BackupAgentIntent } from '@/features/backups/types/BackupAgentIntent';

/** The user's request of a backup chat; the platform sends it inside its visible backup brief. */
export const backupAgentMessage = (intent: BackupAgentIntent, prompt: string, failed?: string | null): string => {
  const request = prompt.trim();
  if (intent === 'setup') return `Set up the backups of this project.\n\n${request}`;
  if (intent === 'update') return `Update the current backup configuration.\n\n${request}`;
  return `The last backup operation${failed ? ` (${failed})` : ''} failed. Read its detail, find the cause and fix the configuration.${request ? `\n\n${request}` : ''}`;
};
