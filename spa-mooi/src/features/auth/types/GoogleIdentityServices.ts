import type { GoogleButtonOptions } from '@/features/auth/types/GoogleButtonOptions';
import type { GoogleInitializeConfig } from '@/features/auth/types/GoogleInitializeConfig';

export interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize: (config: GoogleInitializeConfig) => void;
      renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
      disableAutoSelect: () => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}
