/** How long a shape holds still before the next morph starts. */
export const STAGE_HOLD_MS = 3400;
/** How long a morph takes from release to settled shape (plus each particle's wave delay). */
export const STAGE_MORPH_MS = 1700;
export const STAGE_DURATION_MS = STAGE_HOLD_MS + STAGE_MORPH_MS;
/** Spread of the per-particle delay: a morph sweeps around the shape instead of firing at once. */
export const MORPH_WAVE_MS = 520;
