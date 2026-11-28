import { OverlayPortal } from '@/shared/components/overlays/stack/OverlayPortal';
import { ToastItem } from '@/shared/components/feedback/toast/ToastItem';
import { useToastStore } from '@/shared/components/feedback/toast/toastStore';

/**
 * Where toasts appear: bottom center on phones, above the tab bar and the keyboard; bottom right
 * from `sm`. Mounted once by the app; announced politely, never stealing focus.
 */
export const Toaster = () => {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <OverlayPortal>
      <div className="pointer-events-none fixed inset-x-0 top-(--app-offset) z-(--z-toast) h-app">
        <ol aria-live="polite" aria-label="Notifications"
          className="absolute inset-x-0 bottom-[calc(max(var(--tab-bar-space),var(--safe-bottom))+0.75rem)] flex flex-col items-center gap-2 px-3 sm:right-4 sm:left-auto sm:items-end sm:px-0">
          {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />)}
        </ol>
      </div>
    </OverlayPortal>
  );
};
