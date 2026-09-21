import { Outlet } from 'react-router-dom';
import { useAgentConnectionsSync } from '@/features/agents/hooks/useAgentConnectionsSync';
import { useGithubConnectionSync } from '@/features/github/hooks/useGithubConnectionSync';
import { useProjectsSync } from '@/features/projects/hooks/useProjectsSync';
import { AppMobileDrawer } from '@/layouts/app/AppMobileDrawer';
import { AppSidebar } from '@/layouts/app/AppSidebar';
import { AppTopBar } from '@/layouts/app/AppTopBar';

export const AppLayout = () => {
  useGithubConnectionSync();
  useProjectsSync();
  useAgentConnectionsSync();

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
      <AppSidebar className="hidden w-[240px] shrink-0 border-r border-line lg:flex" />

      <div className="flex min-w-0 flex-1 flex-col lg:p-3 lg:pl-0">
        <AppTopBar />
        <main className="min-h-0 flex-1 overflow-y-auto bg-canvas lg:rounded-b-2xl lg:border lg:border-t-0 lg:border-line">
          <Outlet />
        </main>
      </div>

      <AppMobileDrawer />
    </div>
  );
};
