/** The endpoint comes only from the backend snapshot; never add Mooi credentials. */
export const previewUrl = (value: string | null, mooiOrigin: string): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash
        || url.origin === mooiOrigin) return null;
    return url.href;
  } catch {
    return null;
  }
};
