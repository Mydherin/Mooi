import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from '@/layouts/app/AppSidebar';
import { useLockBodyScroll } from '@/shared/hooks/useLockBodyScroll';
import { useSidebarStore } from '@/stores/sidebarStore';

export const AppMobileDrawer = () => {
  const dialog = useRef<HTMLDialogElement>(null);
  const isOpen = useSidebarStore((state) => state.isOpen);
  const close = useSidebarStore((state) => state.close);
  const { pathname } = useLocation();

  useLockBodyScroll(isOpen);

  useEffect(() => {
    close();
  }, [close, pathname]);

  useEffect(() => {
    const element = dialog.current;
    if (!isOpen || !element) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    return () => { element.close(); trigger?.focus(); };
  }, [isOpen]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) close(); };
    closeOnDesktop();
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [close]);

  if (!isOpen) {
    return null;
  }

  return (
    <dialog ref={dialog} aria-label="Navigation" onCancel={(event) => { event.preventDefault(); close(); }} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-ink backdrop:bg-black/50 backdrop:backdrop-blur-sm">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close navigation"
        onClick={close}
        className="fixed inset-0 z-40 cursor-default bg-transparent"
      />
      <AppSidebar
        className="fixed inset-y-0 left-0 z-50 h-dvh w-[85%] max-w-[320px] border-r border-line shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)]"
        onNavigate={close}
      />
    </dialog>
  );
};
