import { useCallback, useEffect, useRef, useState } from 'react';
import { checkProductionStatus } from '@/features/production/api/productionApi';
import type { ProductionHealth } from '@/features/production/types/ProductionHealth';
import type { ProductionHealthState } from '@/features/production/types/ProductionHealthState';

const HEALTH_INTERVAL_MS = 60_000;

interface UseProductionHealth {
  health: ProductionHealth | null;
  state: ProductionHealthState;
  error: string | null;
  check: () => void;
}

/**
 * Runs status.sh when enabled and then every minute while the tab is visible. The service is never
 * stopped from here: this only reports whether it answers.
 */
export const useProductionHealth = (projectId: string | undefined, enabled: boolean): UseProductionHealth => {
  const [health, setHealth] = useState<ProductionHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const check = useCallback(() => {
    if (!projectId || inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    checkProductionStatus(projectId)
      .then((result) => { setHealth(result); setError(null); })
      .catch((failure: Error) => setError(failure.message))
      .finally(() => { inFlight.current = false; setChecking(false); });
  }, [projectId]);

  useEffect(() => {
    setHealth(null);
    setError(null);
    if (!enabled) return;
    check();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') check(); }, HEALTH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, check]);

  const state: ProductionHealthState = checking ? 'checking' : health?.state ?? 'unknown';

  return { health, state, error, check };
};
