import { authenticatedFetch } from '@/features/auth/lib/authenticatedFetch';
import type { BackupDetail } from '@/features/backups/types/BackupDetail';
import type { BackupsResponse } from '@/features/backups/types/BackupsResponse';
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage';

/** The durable backup records kept by mic-mooi. */
const read = async <T>(response: Response, fallback: string): Promise<T> => {
  if (!response.ok) throw new Error(await apiErrorMessage(response, fallback));
  return (await response.json()) as T;
};

export const fetchBackups = async (page: number): Promise<BackupsResponse> =>
  read(await authenticatedFetch(`/me/backups?page=${page}`), 'Could not load backups.');

export const fetchProjectBackups = async (projectId: string, page = 0): Promise<BackupsResponse> =>
  read(await authenticatedFetch(`/me/projects/${encodeURIComponent(projectId)}/backups?page=${page}`), 'Could not load project backups.');

export const fetchBackupDetail = async (projectId: string, backupId: string): Promise<BackupDetail> =>
  read(await authenticatedFetch(`/me/projects/${encodeURIComponent(projectId)}/backups/${encodeURIComponent(backupId)}`),
    'Could not load backup details.');
