import type { MenuItem } from '@/shared/components/overlays/menu/MenuItem';
import type { ButtonVariant } from '@/shared/types/ButtonVariant';

/** A header action: a menu item that may also be shown as a button. */
export interface ActionItem extends Omit<MenuItem, 'selection' | 'checked' | 'keepOpen'> {
  /** Stays a visible button on phones too (one per screen, two at most). */
  primary?: boolean;
  /** Button style when shown inline; `secondary` by default, `brand` suits the primary. */
  variant?: ButtonVariant;
  /** Shows the work in flight on the inline button. */
  loading?: boolean;
}
