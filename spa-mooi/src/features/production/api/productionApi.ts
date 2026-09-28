import { sessionsFetch } from '@/features/sessions/lib/sessionsFetch';
import type { ChangesSummary } from '@/features/sessions/types/ChangesSummary';
import type { FileDiffPayload } from '@/features/sessions/types/FileDiffPayload';
import type { GithubRelease } from '@/features/production/types/GithubRelease';
import type { ProductionDocuments } from '@/features/production/types/ProductionDocuments';
import type { ProductionFiles } from '@/features/production/types/ProductionFiles';
import type { ProductionHealth } from '@/features/production/types/ProductionHealth';
import type { ProductionOverview } from '@/features/production/types/ProductionOverview';
import type { ProductionSnapshot } from '@/features/production/types/ProductionSnapshot';
import type { ReleaseChoice } from '@/features/production/types/ReleaseChoice';
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage';

/** Project-scoped production endpoints of mic-sessions: none of them needs a chat. */
export const productionPath = (projectId: string): string => `/production/projects/${encodeURIComponent(projectId)}`;

const jsonHeaders = { 'Content-Type': 'application/json' };

const read = async <T>(response: Response, fallback: string): Promise<T> => {
  if (!response.ok) throw new Error(await apiErrorMessage(response, fallback));
  return (await response.json()) as T;
};

export const fetchProductionOverview = async (projectId: string): Promise<ProductionOverview> =>
  read(await sessionsFetch(productionPath(projectId)), 'Could not load the production overview.');

export const fetchProductionDocuments = async (projectId: string): Promise<ProductionDocuments> =>
  read(await sessionsFetch(`${productionPath(projectId)}/documents`), 'Could not load the deployment files.');

export const saveProductionDraft = async (projectId: string, files: ProductionFiles): Promise<ProductionDocuments> =>
  read(await sessionsFetch(`${productionPath(projectId)}/documents/draft`, {
    method: 'PUT', headers: jsonHeaders, body: JSON.stringify(files),
  }), 'Could not save the deployment files.');

/** A null value removes the variable. */
export const updateProductionEnvironment = async (projectId: string, values: Record<string, string | null>): Promise<ProductionDocuments> =>
  read(await sessionsFetch(`${productionPath(projectId)}/environment`, {
    method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ values }),
  }), 'Could not save the environment variables.');

export const deleteProductionConfiguration = async (projectId: string): Promise<void> => {
  const response = await sessionsFetch(`${productionPath(projectId)}/configuration`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Could not delete the deployment configuration.'));
};

export const fetchProductionChanges = async (projectId: string): Promise<ChangesSummary> =>
  read(await sessionsFetch(`${productionPath(projectId)}/changes`), 'Could not load the configuration changes.');

export const fetchProductionFileDiff = async (projectId: string, path: string): Promise<FileDiffPayload> =>
  read(await sessionsFetch(`${productionPath(projectId)}/changes/file?path=${encodeURIComponent(path)}`),
    'Could not load the file diff.');

export const fetchProductionReleases = async (projectId: string): Promise<GithubRelease[]> =>
  (await read<{ releases: GithubRelease[] }>(await sessionsFetch(`${productionPath(projectId)}/releases`),
    'Could not load GitHub releases.')).releases;

export const startProductionDeployment = async (projectId: string, choice: ReleaseChoice): Promise<ProductionSnapshot> =>
  read(await sessionsFetch(`${productionPath(projectId)}/deployments`, {
    method: 'POST', headers: jsonHeaders, body: JSON.stringify(choice),
  }), 'Could not start the production deployment.');

export const deleteProductionDeployment = async (projectId: string, operationId: string): Promise<void> => {
  const response = await sessionsFetch(`${productionPath(projectId)}/deployments/${encodeURIComponent(operationId)}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Could not delete the deployment data.'));
};

export const checkProductionStatus = async (projectId: string): Promise<ProductionHealth> =>
  read(await sessionsFetch(`${productionPath(projectId)}/status`, { method: 'POST' }), 'Could not check the production status.');
