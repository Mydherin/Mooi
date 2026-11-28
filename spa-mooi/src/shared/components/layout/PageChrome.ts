import { createContext, useContext, type RefObject } from 'react';

/**
 * What the app shell offers the screen inside it: the scroll container the page lives in (for
 * the collapsing header) and a way to name the current screen (for desktop breadcrumbs). Provided
 * by `AppLayout`; a screen outside the shell gets inert defaults.
 */
export interface PageChrome {
  scroller: RefObject<HTMLElement | null> | null;
  setTitle: (title: string | null) => void;
}

export const PageChromeContext = createContext<PageChrome>({ scroller: null, setTitle: () => undefined });

export const usePageChrome = (): PageChrome => useContext(PageChromeContext);
