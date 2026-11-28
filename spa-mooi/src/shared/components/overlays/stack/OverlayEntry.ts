export interface OverlayEntry {
  id: string;
  /** Modal entries make everything beneath them inert; non-modal ones (anchored menus) close on outside presses. */
  modal: boolean;
  /** The overlay's layer element, for inert and outside-press detection. */
  layer: () => HTMLElement | null;
  /** Presses here never count as outside (the trigger that toggles the overlay). */
  anchor: () => HTMLElement | null;
  /** False while the overlay must stay (e.g. a request in flight): Escape and Back are ignored. */
  dismissible: () => boolean;
  /** Asks the owner to close; the owner flips its `open` state, which unregisters the entry. */
  dismiss: () => void;
  /** A browser history entry was pushed for this overlay and is still current or below the current one. */
  historyPushed: boolean;
  /** What had focus when the overlay opened (recorded before the background turns inert); it gets focus back. */
  returnFocus: HTMLElement | null;
}
