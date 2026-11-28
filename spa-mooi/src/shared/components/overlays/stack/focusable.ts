const SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
].join(',');

/** Elements inside `root` that Tab can reach, in document order, skipping hidden ones. */
export const focusableWithin = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(SELECTOR))
    .filter((element) => !element.closest('[inert]') && element.getClientRects().length > 0);
