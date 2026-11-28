import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  /** Custom leading content (avatar, initials) instead of `icon`. */
  leading?: ReactNode;
  /** Trailing content (a live status, a shortcut hint). */
  trailing?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  /** A toggle (`checkbox`) or one choice of a group (`radio`); a check shows while `checked`. */
  selection?: 'checkbox' | 'radio';
  checked?: boolean;
  /** Keeps the menu open after selecting, for toggles. */
  keepOpen?: boolean;
  /** An in-app destination: the item is a link (new tab works on desktop). */
  to?: string;
  linkState?: unknown;
  /** An external URL, opened in a new tab. */
  href?: string;
  onSelect?: () => void;
  /** Leaves the item out, e.g. where the same action is already on screen. */
  hidden?: boolean;
}
