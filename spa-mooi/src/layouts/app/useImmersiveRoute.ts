import { useMatches } from 'react-router-dom';
import type { RouteHandle } from '@/shared/types/RouteHandle';

/** True when the current screen is a detail view that owns its header (see `RouteHandle`). */
export const useImmersiveRoute = (): boolean =>
  useMatches().some((match) => (match.handle as RouteHandle | undefined)?.immersive === true);
