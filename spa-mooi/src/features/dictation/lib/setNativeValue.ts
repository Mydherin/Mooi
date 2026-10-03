import type { DictationField } from '@/features/dictation/types/DictationField';

/**
 * Writes through the prototype setter and announces an `input` event, so framework-controlled
 * fields (React included) register the change exactly as if the user had typed it.
 */
export const setNativeValue = (element: DictationField, value: string): void => {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
};
