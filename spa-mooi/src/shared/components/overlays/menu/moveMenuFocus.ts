import type { KeyboardEvent } from 'react';

const ITEMS = '[role^="menuitem"]:not([aria-disabled="true"]), [role="option"]:not([aria-disabled="true"])';

/** Arrow keys, Home and End move between the enabled items of a menu or listbox. Returns true when handled. */
export const moveMenuFocus = (event: KeyboardEvent<HTMLElement>): boolean => {
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(ITEMS)).filter((item) => item.getClientRects().length > 0);
  if (items.length === 0) return false;
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next = event.key === 'ArrowDown' ? (index + 1) % items.length
    : event.key === 'ArrowUp' ? (index <= 0 ? items.length - 1 : index - 1)
      : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
  if (next === null) return false;
  event.preventDefault();
  items[next]?.focus();
  return true;
};
