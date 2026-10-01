import type { DevelopmentEnvironment } from '@/features/development/types/DevelopmentEnvironment';
import { sessionsFetch } from '@/features/sessions/lib/sessionsFetch';
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage';

const environmentPath = (projectId: string): string => `/development/projects/${encodeURIComponent(projectId)}/environment`;

const read = async (response: Response, fallback: string): Promise<DevelopmentEnvironment> => {
  if (!response.ok) throw new Error(await apiErrorMessage(response, fallback));
  return (await response.json()) as DevelopmentEnvironment;
};

export const fetchDevelopmentEnvironment = async (projectId: string): Promise<DevelopmentEnvironment> =>
  read(await sessionsFetch(environmentPath(projectId)), 'Could not load the environment variables.');

/** A null value removes the variable. */
export const updateDevelopmentEnvironment = async (projectId: string, values: Record<string, string | null>): Promise<DevelopmentEnvironment> =>
  read(await sessionsFetch(environmentPath(projectId), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values }),
  }), 'Could not save the environment variables.');
