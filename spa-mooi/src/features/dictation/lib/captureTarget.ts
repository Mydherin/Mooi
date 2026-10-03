import type { DictationField } from '@/features/dictation/types/DictationField';
import type { DictationTarget } from '@/features/dictation/types/DictationTarget';

/**
 * Snapshot of the bound field as a dictation target, or null when it must never be written: a
 * disabled, read-only, detached or password field, or an input type without a selection API
 * (number, email…), whose `selectionStart` is null.
 */
export const captureTarget = (element: DictationField | null): DictationTarget | null => {
  if (!element || element.disabled || element.readOnly || !element.isConnected) return null;
  if (element instanceof HTMLInputElement && element.type === 'password') return null;
  const start = element.selectionStart;
  if (start === null) return null;
  return { element, start, end: element.selectionEnd ?? start, original: element.value };
};
