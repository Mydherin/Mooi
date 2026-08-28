import { MoonStar, Sun } from 'lucide-react';
import { IconButton } from '@/shared/components/IconButton';
import { useThemeStore } from '@/stores/themeStore';

export const ThemeToggle = () => {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  return (
    <IconButton
      icon={theme === 'dark' ? Sun : MoonStar}
      label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggleTheme}
    />
  );
};
