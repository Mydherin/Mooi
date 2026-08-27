import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export const useApplyTheme = (): void => {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);
};
