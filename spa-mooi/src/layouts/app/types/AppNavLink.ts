import type { LucideIcon } from 'lucide-react';

export interface AppNavLink {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Matches the path exactly, for a link whose path prefixes another one. */
  end?: boolean;
  adminOnly?: boolean;
  /** A tab of the phone tab bar; the other links live in its More sheet. */
  tab?: boolean;
  /** The tab bar's caption when `label` does not fit a fifth of a 360 px screen. */
  tabLabel?: string;
  /** Things waiting for the player behind this entry (e.g. factories needing attention); shown as a pill. */
  attention?: number;
}
