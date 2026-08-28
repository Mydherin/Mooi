import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { env } from '@/config/env';
import type { GoogleCredentialResponse } from '@/features/auth/types/GoogleCredentialResponse';

const SCRIPT_ID = 'google-identity-services';
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

const loadScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
      }
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    });
    script.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
    document.head.appendChild(script);
  });

interface UseGoogleIdentityServices {
  containerRef: RefObject<HTMLDivElement | null>;
  isReady: boolean;
}

export const useGoogleIdentityServices = (
  onCredential: (idToken: string) => void,
): UseGoogleIdentityServices => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  const handleCredential = useCallback(
    (response: GoogleCredentialResponse) => {
      onCredential(response.credential);
    },
    [onCredential],
  );

  useEffect(() => {
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: env.googleClientId,
          callback: handleCredential,
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
        });

        setIsReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setIsReady(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [handleCredential]);

  return { containerRef, isReady };
};
