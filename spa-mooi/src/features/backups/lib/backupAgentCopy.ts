import type { BackupAgentIntent } from '@/features/backups/types/BackupAgentIntent';
import type { PlatformAgentCopy } from '@/features/platform/types/PlatformAgentCopy';

export const BACKUP_AGENT_COPY: Record<BackupAgentIntent, PlatformAgentCopy> = {
  setup: {
    title: 'Set up backups',
    description: 'Pick the agent and describe how this project should be backed up. It prepares BACKUP.md, backup.sh, restore.sh and delete.sh with you, then proves them with a real backup and a restore into a disposable copy of production.',
    label: 'What should be backed up, and where?',
    placeholder: 'For example: dump the Postgres database and the uploads volume every time, store them compressed in my S3 bucket…',
    action: 'Start backup setup',
  },
  update: {
    title: 'Change backup settings',
    description: 'Describe what should change. The agent updates the backup files and proves them again with a backup and a verification restore before they become active.',
    label: 'What should change?',
    placeholder: 'For example: also back up the Redis data, move the storage to another bucket, encrypt the archives…',
    action: 'Start update',
  },
  fix: {
    title: 'Fix backups',
    description: 'The agent reads the failed operation, explains the cause and corrects the configuration with you.',
    label: 'Anything the agent should know? (optional)',
    placeholder: 'For example: the database moved to another container, the bucket credentials changed…',
    action: 'Start fixing',
  },
};

export const BACKUP_AGENT_SUGGESTIONS = [
  'Postgres dump and volumes kept on the same server',
  'Database and uploads to an S3 bucket',
  'Compressed archives copied to another host over SSH',
];
