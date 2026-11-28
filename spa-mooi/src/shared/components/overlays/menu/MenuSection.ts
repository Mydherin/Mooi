import type { ReactNode } from 'react';
import type { MenuItem } from '@/shared/components/overlays/menu/MenuItem';

/** A group of items; groups are separated, and a title names the group (submenus become sections). */
export interface MenuSection {
  id: string;
  title?: string;
  /** Read-only text above the items, e.g. why they are disabled. */
  note?: ReactNode;
  items: MenuItem[];
}
