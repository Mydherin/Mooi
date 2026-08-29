import type { LucideIcon } from 'lucide-react';

export interface AppNavLink {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Matches the path exactly, for a link whose path prefixes another one. */
  end?: boolean;
  adminOnly?: boolean;
}
