import type { OverlayEntry } from '@/shared/components/overlays/stack/OverlayEntry';

/**
 * The one registry of open overlays (dialogs, sheets, menus, popovers), in opening order.
 *
 * - Only the topmost overlay reacts to Escape and to outside presses.
 * - Each overlay pushes a history entry when it opens, so the browser/Android Back (and the iOS
 *   edge swipe) closes the topmost overlay before it leaves the page. Closing it any other way
 *   pops that entry silently, so Back is never needed twice and the router never sees it.
 * - Everything beneath the topmost modal overlay (the app in `#root` and lower layers) is `inert`:
 *   no focus, no clicks, no screen-reader reach.
 */

const MARKER = '__overlay';
const stack: OverlayEntry[] = [];
/** History pops we triggered ourselves and must swallow before the router sees them. */
let expectedPops = 0;
/** History pushes waiting for our own pops to land (pushing earlier would be undone by them). */
const pendingPushes: Array<() => void> = [];
const settledWaiters: Array<() => void> = [];
let listening = false;

const markerOf = (state: unknown): string | undefined =>
  typeof state === 'object' && state !== null ? (state as Record<string, unknown>)[MARKER] as string | undefined : undefined;

const isOpenEntry = (id: string | undefined): boolean =>
  id !== undefined && stack.some((entry) => entry.id === id && entry.historyPushed);

const popSilently = (steps = 1): void => {
  expectedPops += 1;
  window.history.go(-steps);
};

const settle = (): void => {
  while (pendingPushes.length > 0 && expectedPops === 0) pendingPushes.shift()?.();
  if (expectedPops === 0) settledWaiters.splice(0).forEach((resolve) => resolve());
};

/** An entry left behind by an overlay that closed while another entry was on top: skipped like it never existed. */
const skipStaleEntry = (state: unknown): boolean => {
  const marker = markerOf(state);
  if (marker === undefined || isOpenEntry(marker)) return false;
  popSilently();
  return true;
};

const onPopState = (event: PopStateEvent): void => {
  if (expectedPops > 0) {
    expectedPops -= 1;
    event.stopImmediatePropagation();
    if (!skipStaleEntry(event.state)) settle();
    return;
  }
  const top = [...stack].reverse().find((entry) => entry.historyPushed);
  if (top) {
    event.stopImmediatePropagation();
    if (top.dismissible()) {
      top.historyPushed = false;
      top.dismiss();
    } else {
      // The overlay must stay (work in flight): put its entry back so the next Back still closes it first.
      window.history.pushState({ ...(window.history.state as object | null), [MARKER]: top.id }, '');
    }
    return;
  }
  if (skipStaleEntry(event.state)) event.stopImmediatePropagation();
};

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape' || event.isComposing) return;
  const top = stack.at(-1);
  if (!top) return;
  event.preventDefault();
  event.stopPropagation();
  if (top.dismissible()) top.dismiss();
};

const onPointerDown = (event: PointerEvent): void => {
  const top = stack.at(-1);
  if (!top || top.modal || !(event.target instanceof Node)) return;
  if (top.layer()?.contains(event.target) || top.anchor()?.contains(event.target)) return;
  if (top.dismissible()) top.dismiss();
};

const listen = (): void => {
  if (listening) return;
  listening = true;
  // Capture on window: at the target phase capture listeners run first, so a swallowed pop never
  // reaches the router's own `popstate` listener.
  window.addEventListener('popstate', onPopState, true);
  window.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('pointerdown', onPointerDown, true);
};

const topModalIndex = (): number => {
  for (let index = stack.length - 1; index >= 0; index -= 1) if (stack[index]?.modal) return index;
  return -1;
};

const syncInert = (): void => {
  const topModal = topModalIndex();
  document.getElementById('root')?.toggleAttribute('inert', topModal >= 0);
  stack.forEach((entry, index) => entry.layer()?.toggleAttribute('inert', index < topModal));
  document.documentElement.toggleAttribute('data-overlay-modal', topModal >= 0);
};

const pushHistory = (entry: OverlayEntry): void => {
  const push = () => {
    if (!stack.includes(entry)) return;
    window.history.pushState({ ...(window.history.state as object | null), [MARKER]: entry.id }, '');
    entry.historyPushed = true;
  };
  if (expectedPops > 0) pendingPushes.push(push);
  else push();
};

/** The last elements that took focus, newest last (see `triggerOf`). */
const recentFocus: HTMLElement[] = [];
const RECENT_FOCUS = 8;

const onFocusIn = (event: FocusEvent): void => {
  if (!(event.target instanceof HTMLElement)) return;
  const index = recentFocus.indexOf(event.target);
  if (index >= 0) recentFocus.splice(index, 1);
  recentFocus.push(event.target);
  if (recentFocus.length > RECENT_FOCUS) recentFocus.shift();
};

// Installed at load, so the very first overlay already knows what opened it.
if (typeof document !== 'undefined') document.addEventListener('focusin', onFocusIn, true);

/**
 * What opened the overlay. Content inside the overlay may already hold focus when it registers
 * (an `autoFocus` field focuses during the commit, before effects run), so the newest focused
 * element outside its layer wins.
 */
const triggerOf = (entry: OverlayEntry): HTMLElement | null => {
  const layer = entry.layer();
  const candidates = [...recentFocus, document.activeElement].reverse();
  for (const element of candidates) {
    if (!(element instanceof HTMLElement) || element === document.body || !element.isConnected) continue;
    if (layer?.contains(element)) continue;
    return element;
  }
  return null;
};

export const registerOverlay = (entry: OverlayEntry): void => {
  listen();
  entry.returnFocus = triggerOf(entry);
  stack.push(entry);
  pushHistory(entry);
  syncInert();
};

export const unregisterOverlay = (entry: OverlayEntry): void => {
  const index = stack.indexOf(entry);
  if (index < 0) return;
  stack.splice(index, 1);
  if (entry.historyPushed) {
    entry.historyPushed = false;
    // Only our own entry is popped; one buried under another overlay's entry is skipped later.
    if (markerOf(window.history.state) === entry.id) popSilently();
  }
  syncInert();
  // Focus goes back to the trigger unless the user already moved it elsewhere (a press outside).
  const active = document.activeElement;
  const focusLost = !active || active === document.body || Boolean(entry.layer()?.contains(active));
  if (focusLost && entry.returnFocus?.isConnected) entry.returnFocus.focus({ preventScroll: true });
};

/**
 * Called before every router navigation (see `app/router`): pops the history entries of open
 * overlays, waits for those pops, and only then lets the navigation push or replace its own entry.
 * Without it, a link inside a sheet would leave the sheet's entry behind the new page, and a pop
 * still in flight would undo the navigation. Overlays still mounted afterwards are asked to close.
 */
export const releaseOverlaysForNavigation = async (): Promise<() => void> => {
  const pushed = stack.filter((entry) => entry.historyPushed);
  pushed.forEach((entry) => { entry.historyPushed = false; });
  pendingPushes.length = 0;
  if (pushed.length > 0 && markerOf(window.history.state) !== undefined) popSilently(pushed.length);
  if (expectedPops > 0) await new Promise<void>((resolve) => settledWaiters.push(resolve));
  const open = [...stack];
  return () => open.reverse().forEach((entry) => { if (stack.includes(entry)) entry.dismiss(); });
};
