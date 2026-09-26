const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEEP_SEGMENTS = 3;

/**
 * Compact form of an absolute path: keeps the last segments (the ones that tell two clones apart)
 * and cuts UUID segments to their first 8 characters, e.g. `…/sessions/1a2b3c4d/repository`.
 */
export const shortenPath = (path: string): string => {
  const segments = path.split('/').filter(Boolean);
  const tail = segments
    .slice(-KEEP_SEGMENTS)
    .map((segment) => (UUID_PATTERN.test(segment) ? segment.slice(0, 8) : segment));

  return segments.length > KEEP_SEGMENTS ? `…/${tail.join('/')}` : `/${tail.join('/')}`;
};
