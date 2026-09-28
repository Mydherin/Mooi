import type { ProductionDeployment } from '@/features/production/types/ProductionDeployment';
import type { ProductionOverview } from '@/features/production/types/ProductionOverview';
import type { ProductionSnapshot } from '@/features/production/types/ProductionSnapshot';
import type { ProductionStage } from '@/features/production/types/ProductionStage';

/** The live snapshot wins over history; history covers deployments from before a service restart. */
export const productionStage = (overview: ProductionOverview, snapshot: ProductionSnapshot | null,
  latest: ProductionDeployment | undefined, hasChat: boolean): ProductionStage => {
  if (snapshot?.state === 'running') return 'deploying';
  if (!overview.configured) return hasChat ? 'preparing' : 'unconfigured';
  const last = snapshot && snapshot.state !== 'idle' ? snapshot.state : latest?.state;
  if (last === 'failed') return 'failed';
  if (last === 'succeeded' && overview.deployed) return 'live';
  return 'ready';
};
