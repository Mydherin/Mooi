import { PRODUCTION_LOG_LIMIT } from '@/features/production/lib/productionLogLimit';
import type { ProductionSnapshot } from '@/features/production/types/ProductionSnapshot';
import type { ProductionStreamEvent } from '@/features/production/types/ProductionStreamEvent';

export interface ProductionStreamState {
  snapshot: ProductionSnapshot | null;
  logs: string[];
}

/** Adopts a snapshot; a different operation starts with an empty console. */
export const applyProductionSnapshot = (state: ProductionStreamState, snapshot: ProductionSnapshot): ProductionStreamState => ({
  snapshot,
  logs: snapshot.operationId === state.snapshot?.operationId ? state.logs : [],
});

/** The single fold over the production stream: sync replaces, updates adopt, output appends. */
export const applyProductionStreamEvent = (state: ProductionStreamState, event: ProductionStreamEvent): ProductionStreamState => {
  switch (event.type) {
    case 'production.sync':
      return { snapshot: event.data.snapshot, logs: event.data.logs };
    case 'production.updated':
      return applyProductionSnapshot(state, event.data);
    case 'production.log':
      return event.data.operationId === state.snapshot?.operationId
        ? { ...state, logs: [...state.logs, ...event.data.lines].slice(-PRODUCTION_LOG_LIMIT) } : state;
    default:
      return state;
  }
};
