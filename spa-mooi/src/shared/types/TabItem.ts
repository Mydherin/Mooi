import type { LucideIcon } from 'lucide-react';

export interface TabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Small trailing count, e.g. the number of changed files. */
  count?: number;
  /** Small trailing status dot, e.g. a linked connection. */
  dot?: boolean;
  /** Trailing close action, e.g. dismissing a chat that finished its job. */
  onClose?: () => void;
  closeLabel?: string;
}
