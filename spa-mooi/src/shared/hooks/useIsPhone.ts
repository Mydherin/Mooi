import { PHONE_QUERY } from '@/shared/hooks/mediaQueries';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';

/** True below `sm`: dialogs become bottom sheets, header actions collapse into menus. */
export const useIsPhone = (): boolean => useMediaQuery(PHONE_QUERY);
