import type { LucideIcon } from 'lucide-react';

export interface AppNavLink {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Matches the path exactly. The dashboard sits at `/`, which prefixes every other route. */
  end?: boolean;
  adminOnly?: boolean;
}
