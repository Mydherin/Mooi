import { DICTATION_MESSAGES } from '@/features/dictation/lib/dictationMessages';

/** Words a `getUserMedia` rejection for the user: what happened and what to do about it. */
export const microphoneErrorMessage = (error: unknown): string => {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return DICTATION_MESSAGES.microphoneDenied;
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return DICTATION_MESSAGES.microphoneMissing;
  if (name === 'NotReadableError' || name === 'AbortError') return DICTATION_MESSAGES.microphoneBusy;
  return DICTATION_MESSAGES.microphoneUnavailable;
};
