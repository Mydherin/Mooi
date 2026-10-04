/** Per-route metadata read by the layout through `useMatches`. */
export interface RouteHandle {
  /** The screen brings its own header with a back button: the global top bar steps aside on phones. */
  immersive?: boolean;
}
