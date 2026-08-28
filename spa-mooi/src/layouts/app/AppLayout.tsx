import { Outlet } from 'react-router-dom';
import { AppMobileDrawer } from '@/layouts/app/AppMobileDrawer';
import { AppSidebar } from '@/layouts/app/AppSidebar';
import { AppTopBar } from '@/layouts/app/AppTopBar';

export const AppLayout = () => (
  <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
    <AppSidebar className="hidden w-[264px] shrink-0 border-r lg:flex" />

    <div className="flex min-w-0 flex-1 flex-col">
      <AppTopBar />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>

    <AppMobileDrawer />
  </div>
);
