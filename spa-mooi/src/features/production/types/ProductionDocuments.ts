import type { ProductionFiles } from './ProductionFiles';

export interface ProductionDocuments {
  active: ProductionFiles | null;
  draft: ProductionFiles | null;
  revision: number;
  /** Names of the stored environment variables; values are write-only. */
  environment: string[];
}
