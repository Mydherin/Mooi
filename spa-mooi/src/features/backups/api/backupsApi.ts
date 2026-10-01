import type { BackupDocuments } from '@/features/backups/types/BackupDocuments';
import type { BackupFiles } from '@/features/backups/types/BackupFiles';
import type { BackupOverview } from '@/features/backups/types/BackupOverview';
import type { BackupSnapshot } from '@/features/backups/types/BackupSnapshot';
import type { RestoreTarget } from '@/features/backups/types/RestoreTarget';
import { sessionsFetch } from '@/features/sessions/lib/sessionsFetch';
import type { ChangesSummary } from '@/features/sessions/types/ChangesSummary';
import type { FileDiffPayload } from '@/features/sessions/types/FileDiffPayload';
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage';

/** Project-scoped backup endpoints of mic-sessions: none of them needs a chat. */
export const backupsPath = (projectId: string): string => `/backups/projects/${encodeURIComponent(projectId)}`;

const jsonHeaders = { 'Content-Type': 'application/json' };

const read = async <T>(response: Response, fallback: string): Promise<T> => {
  if (!response.ok) throw new Error(await apiErrorMessage(response, fallback));
  return (await response.json()) as T;
};

const done = async (response: Response, fallback: string): Promise<void> => {
  if (!response.ok) throw new Error(await apiErrorMessage(response, fallback));
};

const backupPath = (projectId: string, backupId: string): string =>
  `${backupsPath(projectId)}/backups/${encodeURIComponent(backupId)}`;

export const fetchBackupOverview = async (projectId: string): Promise<BackupOverview> =>
  read(await sessionsFetch(backupsPath(projectId)), 'Could not load the backup overview.');

export const fetchBackupDocuments = async (projectId: string): Promise<BackupDocuments> =>
  read(await sessionsFetch(`${backupsPath(projectId)}/documents`), 'Could not load the backup files.');

export const saveBackupDraft = async (projectId: string, files: BackupFiles): Promise<BackupDocuments> =>
  read(await sessionsFetch(`${backupsPath(projectId)}/documents/draft`, {
    method: 'PUT', headers: jsonHeaders, body: JSON.stringify(files),
  }), 'Could not save the backup files.');

/** A null value removes the variable. */
export const updateBackupEnvironment = async (projectId: string, values: Record<string, string | null>): Promise<BackupDocuments> =>
  read(await sessionsFetch(`${backupsPath(projectId)}/environment`, {
    method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ values }),
  }), 'Could not save the environment variables.');

export const deleteBackupConfiguration = async (projectId: string): Promise<void> =>
  done(await sessionsFetch(`${backupsPath(projectId)}/configuration`, { method: 'DELETE' }), 'Could not delete the backup configuration.');

export const fetchBackupChanges = async (projectId: string): Promise<ChangesSummary> =>
  read(await sessionsFetch(`${backupsPath(projectId)}/changes`), 'Could not load the configuration changes.');

export const fetchBackupFileDiff = async (projectId: string, path: string): Promise<FileDiffPayload> =>
  read(await sessionsFetch(`${backupsPath(projectId)}/changes/file?path=${encodeURIComponent(path)}`), 'Could not load the file diff.');

export const createBackup = async (projectId: string): Promise<BackupSnapshot> =>
  read(await sessionsFetch(`${backupsPath(projectId)}/backups`, { method: 'POST' }), 'Could not start the backup.');

export const restoreBackup = async (projectId: string, backupId: string, target: RestoreTarget): Promise<BackupSnapshot> =>
  read(await sessionsFetch(`${backupPath(projectId, backupId)}/restore`, {
    method: 'POST', headers: jsonHeaders, body: JSON.stringify({ target }),
  }), 'Could not start the restore.');

/** Runs delete.sh; the record disappears once the stored data is gone. */
export const deleteBackupData = async (projectId: string, backupId: string): Promise<BackupSnapshot> =>
  read(await sessionsFetch(`${backupPath(projectId, backupId)}/delete`, { method: 'POST' }), 'Could not delete the backup.');

/** Forgets the record without touching the stored data. */
export const forgetBackup = async (projectId: string, backupId: string): Promise<void> =>
  done(await sessionsFetch(backupPath(projectId, backupId), { method: 'DELETE' }), 'Could not remove the backup record.');
