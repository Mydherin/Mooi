/** The desktop preview always lays the app out at a real desktop resolution, scaled to fit. */
export const DESKTOP_PREVIEW = { width: 1920, height: 1080 } as const;

/** Mobile preview viewport width (CSS px). */
export const MOBILE_PREVIEW_WIDTH = 390;

/** Desktop preview zoom: largest scale and the factor of one zoom step. */
export const PREVIEW_MAX_SCALE = 2;
export const PREVIEW_ZOOM_STEP = 1.25;

/** Where the app itself uses its phone layout: the preview opens in its mobile viewport there. */
export const COMPACT_LAYOUT_QUERY = '(max-width: 1023px)';
