import { MoonStar, Sun } from 'lucide-react';
import { Card } from '@/shared/components/Card';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import type { SegmentItem } from '@/shared/types/SegmentItem';
import type { Theme } from '@/shared/types/Theme';
import { useThemeStore } from '@/stores/themeStore';

const themes: SegmentItem[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: MoonStar },
];

export const PreferencesCard = () => {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold tracking-tight text-ink">Preferences</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
        The workspace follows this theme on every device you sign in from.
      </p>

      <SegmentedControl
        items={themes}
        value={theme}
        onChange={(id) => setTheme(id as Theme)}
        className="mt-5 flex w-full"
      />
    </Card>
  );
};
