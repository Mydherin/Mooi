import { useCallback, useEffect, useState } from 'react';
import { productionPath } from '@/features/production/api/productionApi';
import { applyProductionSnapshot, applyProductionStreamEvent, type ProductionStreamState } from '@/features/production/lib/applyProductionStreamEvent';
import type { ProductionSnapshot } from '@/features/production/types/ProductionSnapshot';
import type { ProductionStreamEvent } from '@/features/production/types/ProductionStreamEvent';
import { openEventStream, type EventStreamState } from '@/features/sessions/lib/openEventStream';

const EMPTY: ProductionStreamState = { snapshot: null, logs: [] };

interface UseProductionStream extends ProductionStreamState {
  streamState: EventStreamState;
  /** Bumps whenever the configuration or its environment changes on the server. */
  configurationRevision: number;
  adoptSnapshot: (snapshot: ProductionSnapshot) => void;
}

/** Live deployment state and console output of one project, kept for as long as the page is open. */
export const useProductionStream = (projectId: string | undefined): UseProductionStream => {
  const [state, setState] = useState<{ projectId?: string } & ProductionStreamState>({ projectId, ...EMPTY });
  const [streamState, setStreamState] = useState<EventStreamState>('closed');
  const [configurationRevision, setConfigurationRevision] = useState(0);
  const current = state.projectId === projectId ? state : { projectId, ...EMPTY };

  useEffect(() => {
    if (!projectId) return;
    return openEventStream({
      path: `${productionPath(projectId)}/events`,
      after: 0,
      onFrame: (frame) => {
        const event = frame as unknown as ProductionStreamEvent;
        setState((previous) => ({ projectId, ...applyProductionStreamEvent(previous.projectId === projectId ? previous : EMPTY, event) }));
        if (event.type === 'production.configuration') setConfigurationRevision((value) => value + 1);
      },
      onState: setStreamState,
    });
  }, [projectId]);

  const adoptSnapshot = useCallback((snapshot: ProductionSnapshot) => setState((previous) =>
    ({ projectId, ...applyProductionSnapshot(previous.projectId === projectId ? previous : EMPTY, snapshot) })), [projectId]);

  return { snapshot: current.snapshot, logs: current.logs, streamState, configurationRevision, adoptSnapshot };
};
