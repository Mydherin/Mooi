/** Phones: below Tailwind's `sm`. Every phone-only presentation keys off this query. */
export const PHONE_QUERY = '(max-width: 639px)';
/** Desktop shell (sidebar, top bar): Tailwind's `lg` and up. */
export const DESKTOP_QUERY = '(min-width: 1024px)';
/** Menus, selects and pickers present as action sheets on phones and on any touch screen. */
export const SHEET_PICKER_QUERY = '(max-width: 639px), (pointer: coarse)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
