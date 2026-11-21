import { useEffect } from 'react';
import { fetchFactories } from '@/features/factory/api/factoryApi';
import { useLiveStore } from '@/stores/liveStore';

/**
 * Reads every factory of the player once per live-channel epoch, for the attention badges of the menu
 * and the project cards; `factory.updated` keeps them current in between. One small query, whatever
 * the number of projects.
 */
export const useFactoriesSync = (): void => {
  const epoch = useLiveStore((live) => live.epoch);

  useEffect(() => {
    let active = true;
    fetchFactories()
      .then((factories) => { if (active) useLiveStore.getState().adoptFactories(factories); })
      .catch(() => undefined); // Badges are a hint: the Factory tab reads and reports on its own.
    return () => { active = false; };
  }, [epoch]);
};
