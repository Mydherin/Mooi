import type { ProductionDeployment } from './ProductionDeployment';
import type { ProductionFiles } from './ProductionFiles';

export interface ProductionDeploymentDetail {
  deployment: ProductionDeployment;
  files: Omit<ProductionFiles, 'targets'> | null;
  message: string | null;
  logs: string[];
}
