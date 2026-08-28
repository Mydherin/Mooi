import type { GoogleCredentialResponse } from '@/features/auth/types/GoogleCredentialResponse';

export interface GoogleInitializeConfig {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
}
