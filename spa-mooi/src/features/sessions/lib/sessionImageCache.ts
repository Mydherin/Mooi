import { fetchSessionImage } from '@/features/sessions/api/sessionsApi';

const LIMIT = 200;
const urls = new Map<string, string>();
const loading = new Map<string, Promise<string>>();

const keyOf = (sessionId: string, imageId: string) => `${sessionId}/${imageId}`;

const remember = (key: string, blob: Blob): string => {
  const known = urls.get(key);
  if (known) return known;
  const url = URL.createObjectURL(blob);
  urls.set(key, url);
  // Oldest first: a long conversation never holds more than LIMIT decoded blobs.
  for (const [oldest, oldUrl] of urls) {
    if (urls.size <= LIMIT) break;
    urls.delete(oldest);
    URL.revokeObjectURL(oldUrl);
  }
  return url;
};

/**
 * Object URLs of session images. Stored images never change, so each is downloaded at most once
 * per page; the sender's own copies are seeded from the local blobs and never downloaded at all.
 */
export const cachedSessionImage = (sessionId: string, imageId: string): string | null =>
  urls.get(keyOf(sessionId, imageId)) ?? null;

export const seedSessionImage = (sessionId: string, imageId: string, blob: Blob): void => {
  remember(keyOf(sessionId, imageId), blob);
};

export const loadSessionImage = (sessionId: string, imageId: string): Promise<string> => {
  const key = keyOf(sessionId, imageId);
  const known = urls.get(key);
  if (known) return Promise.resolve(known);
  let pending = loading.get(key);
  if (!pending) {
    pending = fetchSessionImage(sessionId, imageId)
      .then((blob) => remember(key, blob))
      .finally(() => loading.delete(key));
    loading.set(key, pending);
  }
  return pending;
};
