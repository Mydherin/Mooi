import { create } from 'zustand';

interface PageTitleState {
  /** The current screen's title, as its `PageHeader` names it; null while it has none. */
  title: string | null;
  setTitle: (title: string | null) => void;
}

/** Feeds the desktop breadcrumbs without re-rendering the shell around the screen. */
export const usePageTitleStore = create<PageTitleState>((set) => ({
  title: null,
  setTitle: (title) => set({ title }),
}));
