import { useEffect, useState } from 'react';
import { cachedSessionImage, loadSessionImage } from '@/features/sessions/lib/sessionImageCache';

interface SessionImageUrl {
  url: string | null;
  failed: boolean;
}

/**
 * A displayable URL for one stored session image, downloaded through the authenticated client
 * once. Stored images are immutable: render one consumer per image id (keyed by it).
 */
export const useSessionImageUrl = (sessionId: string, imageId: string): SessionImageUrl => {
  const [state, setState] = useState<SessionImageUrl>(() => ({ url: cachedSessionImage(sessionId, imageId), failed: false }));

  useEffect(() => {
    if (state.url) return;
    let cancelled = false;
    loadSessionImage(sessionId, imageId)
      .then((url) => { if (!cancelled) setState({ url, failed: false }); })
      .catch(() => { if (!cancelled) setState({ url: null, failed: true }); });
    return () => { cancelled = true; };
  }, [sessionId, imageId, state.url]);

  return state;
};
