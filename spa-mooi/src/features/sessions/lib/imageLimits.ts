/** Mirrors mic-sessions `shared/images.py`: what a single message may carry. */
export const MAX_MESSAGE_IMAGES = 8;
export const MAX_IMAGE_BYTES = 3_750_000;
/** Longest edge sent to the model; larger images are scaled down, which providers do anyway. */
export const MAX_IMAGE_EDGE = 2048;
export const SENDABLE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
