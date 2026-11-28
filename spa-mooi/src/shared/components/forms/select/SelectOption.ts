import type { ReactNode } from 'react';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  /** Leading visual (initials, an icon). */
  leading?: ReactNode;
  disabled?: boolean;
  /** Extra text the search matches (a full name, an id). */
  keywords?: string;
}
