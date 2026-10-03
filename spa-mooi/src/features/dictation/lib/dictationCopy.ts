import type { DictationState } from '@/features/dictation/types/DictationState';

/** Button `aria-label` and `title` per state. */
export const DICTATION_STATE_LABELS: Record<DictationState, string> = {
  idle: 'Dictate (tap, hold or Ctrl+Shift+.)',
  connecting: 'Connecting microphone…',
  recording: 'Stop dictation (Esc to discard)',
  stopping: 'Finishing transcription…',
};
