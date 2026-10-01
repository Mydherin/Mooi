import type { PlatformDocumentField } from '@/features/platform/types/PlatformDocumentField';
import type { ProductionFiles } from '@/features/production/types/ProductionFiles';

/** The three platform documents in the order they are shown. */
export const PRODUCTION_DOCUMENTS: PlatformDocumentField<ProductionFiles>[] = [
  { name: 'DEPLOYMENT.md', key: 'manifest', summary: 'What the deployment does' },
  { name: 'deploy.sh', key: 'script', summary: 'Runs from the release checkout' },
  { name: 'status.sh', key: 'statusScript', summary: 'Checks the live service' },
];
