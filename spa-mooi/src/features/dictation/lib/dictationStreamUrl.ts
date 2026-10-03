import { env } from '@/config/env';

/** WebSocket twin of the speech service base URL: `ws:` for `http:`, `wss:` for `https:`. */
export const dictationStreamUrl = (): string => {
  const url = new URL('/api/stt/stream', env.speechBaseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
};
