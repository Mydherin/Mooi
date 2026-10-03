import type { DictationField } from '@/features/dictation/types/DictationField';

/** The field to dictate into, with the selection and value it had when dictation started. */
export interface DictationTarget {
  element: DictationField;
  start: number;
  end: number;
  original: string;
}
