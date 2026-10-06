import type { BackLink } from '@/shared/types/BackLink';

/** Router state for a link whose target should lead back here (read by `useBackLink`). */
export const backLinkState = (backLink: BackLink): { backLink: BackLink } => ({ backLink });
