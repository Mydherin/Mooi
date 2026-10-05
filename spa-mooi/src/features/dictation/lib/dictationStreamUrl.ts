import { env } from '@/config/env';

/**
 * WebSocket twin of the speech service base URL: `ws:` for `http:`, `wss:` for `https:`. A path-only
 * base (a preview's `/preview/<id>/`) resolves against the current page and keeps its prefix.
 */
export const dictationStreamUrl = (): string => {
  const base = new URL(env.speechBaseUrl, window.location.href);
  const url = new URL('api/stt/stream', base.href.endsWith('/') ? base : `${base.href}/`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
};
