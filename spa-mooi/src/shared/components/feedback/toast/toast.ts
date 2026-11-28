import type { ToastMessage } from '@/shared/components/feedback/toast/ToastMessage';
import { useToastStore } from '@/shared/components/feedback/toast/toastStore';

let sequence = 0;

/**
 * Transient feedback that something happened ("Copied", "Release 1.4.0 created"). Callable from
 * anywhere, components or not. Not for errors the user must act on: show those inline (`Alert`).
 * Returns the id, to dismiss it early.
 */
export const toast = (input: Omit<ToastMessage, 'id'> & { id?: string }): string => {
  sequence += 1;
  const id = input.id ?? `toast-${sequence}`;
  useToastStore.getState().push({ duration: input.tone === 'danger' ? 6000 : 3500, ...input, id });
  return id;
};
