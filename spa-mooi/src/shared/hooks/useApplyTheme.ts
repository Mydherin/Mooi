import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

/** The browser and system bars take the page color (phone headers sit on it), so they read as part of the app. */
const syncThemeColor = (root: HTMLElement): void => {
  const color = getComputedStyle(root).getPropertyValue('--canvas').trim();
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta && color) meta.content = color;
};

export const useApplyTheme = (): void => {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    syncThemeColor(root);
  }, [theme]);
};
