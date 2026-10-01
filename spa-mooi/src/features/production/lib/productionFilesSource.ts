import { fetchProductionChanges, fetchProductionDocuments } from '@/features/production/api/productionApi';

/** Where the production platform files and their pending changes are read from. */
export const PRODUCTION_FILES_SOURCE = { fetchDocuments: fetchProductionDocuments, fetchChanges: fetchProductionChanges };
