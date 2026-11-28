import { SHEET_PICKER_QUERY } from '@/shared/hooks/mediaQueries';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';

/** True when menus, selects and popovers should present as bottom sheets (phones and touch screens). */
export const useSheetPickers = (): boolean => useMediaQuery(SHEET_PICKER_QUERY);
