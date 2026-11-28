import { MoonStar, Sun } from 'lucide-react';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { SegmentedControl } from '@/shared/components/navigation/SegmentedControl';
import type { SegmentItem } from '@/shared/types/SegmentItem';
import type { Theme } from '@/shared/types/Theme';
import { useThemeStore } from '@/stores/themeStore';

const themes: SegmentItem[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: MoonStar },
];

/** The theme of this device: it does not travel with the account. */
export const AppearanceGroup = () => {
  const theme = useThemeStore((state) => state.theme);

  return (
    <ListGroup title="Appearance" footer="Saved on this device only.">
      <li className="flex min-h-13 min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-surface px-4 py-2.5">
        <span id="account-theme" className="text-body font-medium text-ink">Theme</span>
        <SegmentedControl items={themes} value={theme} labelledBy="account-theme"
          onChange={(id) => useThemeStore.getState().setTheme(id as Theme)} className="w-full sm:w-auto" />
      </li>
    </ListGroup>
  );
};
