import type { LucideIcon } from 'lucide-react';

/** A way out of the list below the options ("Add repository", "Create project"). */
export interface SelectAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}
