import { useState, type ReactNode } from 'react';
import { usePreviewPanGestures } from '@/features/sessions/hooks/usePreviewPanGestures';
import { DESKTOP_PREVIEW, MOBILE_PREVIEW_WIDTH } from '@/features/sessions/lib/previewViewports';
import type { PreviewDevice } from '@/features/sessions/types/PreviewDevice';
import type { PreviewZoom } from '@/features/sessions/types/PreviewZoom';
import { cn } from '@/shared/utils/cn';

interface PreviewViewportProps {
  device: PreviewDevice;
  zoom: PreviewZoom;
  /** Gestures move and zoom the view instead of reaching the app. */
  navigating: boolean;
  children: ReactNode;
}

/**
 * Lays the frame out at the device's real viewport: the phone width, or a true 1920×1080 desktop
 * scaled into the panel (zoomable and scrollable). One tree for both, so switching devices keeps
 * the running app instead of reloading it.
 */
export const PreviewViewport = ({ device, zoom, navigating, children }: PreviewViewportProps) => {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const desktop = device === 'desktop';
  usePreviewPanGestures(desktop && navigating ? layer : null, zoom);
  const { width, height } = DESKTOP_PREVIEW;

  return <div className="relative min-h-0 w-full flex-1">
    <div ref={zoom.setViewport} className={cn('absolute inset-0 flex overscroll-contain', desktop ? 'overflow-auto' : 'overflow-hidden')}>
      <div ref={zoom.setContent} className={cn('relative m-auto shrink-0', desktop && 'overflow-hidden shadow-sm')}
        style={desktop ? { width: width * zoom.scale, height: height * zoom.scale } : { width: '100%', maxWidth: MOBILE_PREVIEW_WIDTH, height: '100%' }}>
        <div className="absolute left-0 top-0 origin-top-left"
          style={desktop ? { width, height, transform: `scale(${zoom.scale})` } : { width: '100%', height: '100%' }}>
          {children}
        </div>
      </div>
    </div>
    {desktop && navigating && <div ref={setLayer} aria-hidden className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing" />}
  </div>;
};
