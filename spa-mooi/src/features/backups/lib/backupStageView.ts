import { CircleAlert, CircleDashed, DatabaseBackup, LoaderCircle, Rocket, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import type { BackupStage } from '@/features/backups/types/BackupStage';
import type { Tone } from '@/shared/types/Tone';

interface BackupStageView {
  label: string;
  tone: Tone;
  icon: LucideIcon;
  title: string;
  description: string;
}

export const BACKUP_STAGE_VIEWS: Record<BackupStage, BackupStageView> = {
  undeployed: {
    label: 'Not deployed', tone: 'neutral', icon: Rocket, title: 'Deploy to production first',
    description: 'Backups always belong to the release running in production. Deploy the project from Deployments, then set its backups up here.',
  },
  unconfigured: {
    label: 'Not configured', tone: 'neutral', icon: CircleDashed, title: 'No backups yet',
    description: 'Describe what to protect and where to keep it. An agent prepares the backup, restore and delete scripts with you and proves them before they go live.',
  },
  preparing: {
    label: 'Preparing', tone: 'info', icon: Sparkles, title: 'The agent is preparing the backups',
    description: 'Answer its questions in the chat. It runs a real backup and restores it into a disposable copy of production before the scripts become active.',
  },
  ready: {
    label: 'Ready', tone: 'brand', icon: DatabaseBackup, title: 'Ready to back up',
    description: 'The scripts are tested. Create a backup of the release running in production.',
  },
  running: {
    label: 'Running', tone: 'info', icon: LoaderCircle, title: 'Operation in progress',
    description: 'The production instance stays stopped while its data is copied. Follow the script output in the console.',
  },
  protected: {
    label: 'Protected', tone: 'success', icon: ShieldCheck, title: 'Backed up',
    description: 'The latest backup succeeded. Restore any backup of the running release, or verify it in a disposable instance.',
  },
  failed: {
    label: 'Needs attention', tone: 'danger', icon: CircleAlert, title: 'The last operation failed',
    description: 'Review the output and let the agent adjust the scripts, then try again.',
  },
};
