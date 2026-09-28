import type { ProductionDocumentName } from '@/features/production/types/ProductionDocumentName';
import type { ProductionFiles } from '@/features/production/types/ProductionFiles';

export interface ProductionDocumentField {
  name: ProductionDocumentName;
  key: keyof ProductionFiles;
  summary: string;
}

/** The three platform documents in the order they are shown. */
export const PRODUCTION_DOCUMENTS: ProductionDocumentField[] = [
  { name: 'DEPLOYMENT.md', key: 'manifest', summary: 'What the deployment does' },
  { name: 'deploy.sh', key: 'script', summary: 'Runs from the release checkout' },
  { name: 'status.sh', key: 'statusScript', summary: 'Checks the live service' },
];
