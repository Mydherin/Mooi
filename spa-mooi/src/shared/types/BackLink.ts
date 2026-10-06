/** Where a detail screen's back button leads; carried in the router state by the screen that opened it. */
export interface BackLink {
  to: string;
  /** Destination name, e.g. "Sessions" for "Back to Sessions". */
  label: string;
}
