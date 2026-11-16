import type { ProductionTarget } from './ProductionTarget';

/** Production documents and destinations: stored only in the platform, never in the repository. */
export interface ProductionFiles {
  manifest: string;
  script: string;
  statusScript: string | null;
  targets: ProductionTarget[];
}
