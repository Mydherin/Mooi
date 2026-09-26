import type { ReactNode } from 'react';
import { Tooltip } from '@/shared/components/Tooltip';

interface HeaderActionHintProps {
  /** Feedback of the wrapped action: an error, a progress step or what the action is about to do. */
  hint: ReactNode;
  children: ReactNode;
}

/**
 * Header actions never print their feedback next to themselves: a line of text would resize the
 * row and push the other controls around. The hint lives in a tooltip, and in a live region so
 * screen readers still hear it as it changes.
 */
export const HeaderActionHint = ({ hint, children }: HeaderActionHintProps) => (
  <span className="relative inline-flex shrink-0">
    {hint ? <Tooltip content={hint} align="end" mono={false}>{children}</Tooltip> : children}
    <span className="sr-only" aria-live="polite" aria-atomic="true">{hint}</span>
  </span>
);
