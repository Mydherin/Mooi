import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from '@/layouts/app/AppSidebar';
import { useLockBodyScroll } from '@/shared/hooks/useLockBodyScroll';
import { useOnEscape } from '@/shared/hooks/useOnEscape';
import { useSidebarStore } from '@/stores/sidebarStore';

export const AppMobileDrawer = () => {
  const isOpen = useSidebarStore((state) => state.isOpen);
  const close = useSidebarStore((state) => state.close);
  const { pathname } = useLocation();

  useOnEscape(close, isOpen);
  useLockBodyScroll(isOpen);

  useEffect(() => {
    close();
  }, [close, pathname]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Close navigation"
        onClick={close}
        className="fixed inset-0 z-40 cursor-default bg-canvas/70 backdrop-blur-sm"
      />
      <AppSidebar
        className="fixed inset-y-0 left-0 z-50 w-[80%] max-w-[300px] border-r"
        onNavigate={close}
      />
    </div>
  );
};
