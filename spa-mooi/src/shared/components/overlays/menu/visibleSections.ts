import type { MenuSection } from '@/shared/components/overlays/menu/MenuSection';

/** Sections with their hidden items left out, and empty sections dropped. */
export const visibleSections = (sections: MenuSection[]): MenuSection[] =>
  sections
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.hidden) }))
    .filter((section) => section.items.length > 0 || section.note);
