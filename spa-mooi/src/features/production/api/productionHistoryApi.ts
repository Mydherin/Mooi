import { authenticatedFetch } from '@/features/auth/lib/authenticatedFetch';
import type { ProductionDeployment } from '@/features/production/types/ProductionDeployment';
import type { ProductionDeploymentDetail } from '@/features/production/types/ProductionDeploymentDetail';
import { apiErrorMessage } from '@/shared/utils/apiErrorMessage';

/** The durable deployment history kept by mic-mooi. */
export interface ProductionDeploymentsPage {
  deployments: ProductionDeployment[];
  hasMore: boolean;
}

export const fetchProductionDeployments = async (page: number): Promise<ProductionDeploymentsPage> => {
  const response = await authenticatedFetch(`/me/production/deployments?page=${page}`);
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Could not load deployments.'));
  return (await response.json()) as ProductionDeploymentsPage;
};

export const fetchProjectProductionDeployments = async (projectId: string, page = 0): Promise<ProductionDeploymentsPage> => {
  const response = await authenticatedFetch(`/me/projects/${encodeURIComponent(projectId)}/production/deployments?page=${page}`);
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Could not load project deployments.'));
  return (await response.json()) as ProductionDeploymentsPage;
};

export const fetchProductionDeploymentDetail = async (projectId: string, operationId: string): Promise<ProductionDeploymentDetail> => {
  const response = await authenticatedFetch(`/me/projects/${encodeURIComponent(projectId)}/production/deployments/${encodeURIComponent(operationId)}`);
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Could not load deployment details.'));
  return (await response.json()) as ProductionDeploymentDetail;
};
