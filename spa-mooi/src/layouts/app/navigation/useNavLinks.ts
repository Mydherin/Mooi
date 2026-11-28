import { useMemo } from 'react';
import { factoryNeedsAttention } from '@/features/factory/lib/factoryNeedsAttention';
import { appNavLinks } from '@/layouts/app/navigation/appNavLinks';
import type { AppNavLink } from '@/layouts/app/types/AppNavLink';
import { useAuthStore } from '@/stores/authStore';
import { useLiveStore } from '@/stores/liveStore';

/**
 * The destinations this player may open, with what waits behind them. Factories live in their
 * projects, so the Projects entry counts the ones waiting for the player.
 */
export const useNavLinks = (): AppNavLink[] => {
  const admin = useAuthStore((state) => state.player?.role === 'admin');
  const waiting = useLiveStore((live) => Object.values(live.factories).filter(factoryNeedsAttention).length);

  return useMemo(() => appNavLinks
    .filter((link) => !link.adminOnly || admin)
    .map((link) => (link.id === 'projects' && waiting > 0 ? { ...link, attention: waiting } : link)), [admin, waiting]);
};
