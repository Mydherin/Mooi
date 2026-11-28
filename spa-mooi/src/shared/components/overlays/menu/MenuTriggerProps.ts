import type { MouseEvent, RefObject } from 'react';

/** Spread onto a custom trigger button (`renderTrigger`): it toggles the overlay and names it. */
export interface MenuTriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  'aria-haspopup': 'menu' | 'dialog' | 'listbox';
  'aria-expanded': boolean;
  'aria-controls'?: string;
  'data-state': 'open' | 'closed';
}
