import { useLocation } from 'react-router-dom';
import type { BackLink } from '@/shared/types/BackLink';

const isBackLink = (value: unknown): value is BackLink =>
  typeof value === 'object' && value !== null
  && typeof (value as BackLink).to === 'string' && (value as BackLink).to.startsWith('/') && !(value as BackLink).to.startsWith('//')
  && typeof (value as BackLink).label === 'string';

/**
 * The back destination the opening screen left in the router state with `backLinkState` (it survives
 * reloads of the same history entry), or `fallback` for deep links and every other way in.
 */
export const useBackLink = (fallback: BackLink): BackLink => {
  const state: unknown = useLocation().state;
  const backLink = typeof state === 'object' && state !== null ? (state as { backLink?: unknown }).backLink : undefined;

  return isBackLink(backLink) ? backLink : fallback;
};
