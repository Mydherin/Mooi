import { env } from '@/config/env';

/**
 * The backend snapshot carries only the capability path `/preview/<id>/`, served by the sessions
 * service's host (Mooi's own origin behind the production gateway). Never add Mooi credentials.
 */
export const previewUrl = (value: string | null): string | null => {
  if (!value || !/^\/preview\/[a-z2-7]{32}\/$/.test(value)) return null;
  try {
    const url = new URL(value, new URL(env.sessionsBaseUrl, window.location.href));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};
