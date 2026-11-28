import { useEffect, useMemo, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useAgentConnectionsSync } from '@/features/agents/hooks/useAgentConnectionsSync';
import { useFactoriesSync } from '@/features/factory/hooks/useFactoriesSync';
import { useGithubConnectionSync } from '@/features/github/hooks/useGithubConnectionSync';
import { useLiveChannelSync } from '@/features/live/hooks/useLiveChannelSync';
import { useProjectsSync } from '@/features/projects/hooks/useProjectsSync';
import { useRecipeMarketplacesSync } from '@/features/recipes/hooks/useRecipeMarketplacesSync';
import { useImmersiveRoute } from '@/layouts/app/hooks/useImmersiveRoute';
import { useRouteFadeFallback } from '@/layouts/app/hooks/useRouteFadeFallback';
import { useScrollRestoration } from '@/layouts/app/hooks/useScrollRestoration';
import { AppSidebar } from '@/layouts/app/sidebar/AppSidebar';
import { AppTabBar } from '@/layouts/app/tab-bar/AppTabBar';
import { AppTopBar } from '@/layouts/app/top-bar/AppTopBar';
import { PageChromeContext, type PageChrome } from '@/shared/components/layout/PageChrome';
import { DESKTOP_QUERY } from '@/shared/hooks/mediaQueries';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { usePageTitleStore } from '@/stores/pageTitleStore';

/** The live data every screen relies on, kept in sync for as long as the shell is mounted. */
const useShellSync = (): void => {
  useGithubConnectionSync();
  useProjectsSync();
  useAgentConnectionsSync();
  useRecipeMarketplacesSync();
  useLiveChannelSync();
  useFactoriesSync();
};

/**
 * The frame. Desktop: a collapsible sidebar on the shell color and the content panel laid on it
 * as a rounded sheet, under a breadcrumb bar. Phones: the content fills the screen and a tab bar
 * floats at the bottom (hidden on immersive screens and while typing). `main` is the one page
 * scroller: its position is restored on Back, its overscroll never reaches the shell, and only it
 * cross-fades between screens (`view-transition-name: page`).
 */
export const AppLayout = () => {
  useShellSync();
  const main = useRef<HTMLElement>(null);
  const immersive = useImmersiveRoute();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  useScrollRestoration(main);
  useRouteFadeFallback(main);
  const tabBar = !desktop && !immersive;
  const chrome = useMemo<PageChrome>(() => ({ scroller: main, setTitle: usePageTitleStore.getState().setTitle }), []);

  // The tab bar's height reaches overlays (toasts) through `--tab-bar-space` on the root.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-tab-bar', tabBar);
    return () => document.documentElement.removeAttribute('data-tab-bar');
  }, [tabBar]);

  return (
    <PageChromeContext.Provider value={chrome}>
      <div className="relative isolate flex h-full overflow-hidden bg-canvas pt-(--safe-top) pr-(--safe-right) pl-(--safe-left) text-ink lg:bg-shell">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden lg:block [background:radial-gradient(60rem_30rem_at_12%_-10%,var(--glow-a),transparent_70%),radial-gradient(50rem_28rem_at_100%_0%,var(--glow-b),transparent_70%)]" />
        {desktop ? <AppSidebar className="shrink-0" /> : null}

        <div className="relative flex min-w-0 flex-1 flex-col lg:py-2 lg:pr-2">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas lg:rounded-panel lg:border lg:border-line lg:shadow-raised">
            {desktop ? <AppTopBar /> : null}
            <main ref={main} data-scroller
              className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-canvas pb-(--tab-bar-space) [view-transition-name:page]">
              <Outlet />
            </main>
          </div>
          {tabBar ? <AppTabBar /> : null}
        </div>
      </div>
    </PageChromeContext.Provider>
  );
};
