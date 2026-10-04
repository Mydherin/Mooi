import { useEffect } from 'react';
import type { PreviewZoom } from '@/features/sessions/types/PreviewZoom';

interface Point {
  x: number;
  y: number;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Navigation gestures on the layer over the desktop preview (the cross-origin frame cannot report
 * its own): one pointer drags the view, two pinch-zoom around their midpoint; the wheel scrolls,
 * and with Ctrl/⌘ (trackpad pinch) zooms at the cursor.
 */
export const usePreviewPanGestures = (layer: HTMLDivElement | null, { zoomBy, panBy }: PreviewZoom): void => {
  useEffect(() => {
    if (!layer) return;
    const pointers = new Map<number, Point>();

    const onDown = (event: PointerEvent) => {
      layer.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    };

    const onMove = (event: PointerEvent) => {
      const last = pointers.get(event.pointerId);
      if (!last) return;
      const point = { x: event.clientX, y: event.clientY };
      if (pointers.size === 1) {
        pointers.set(event.pointerId, point);
        panBy(point.x - last.x, point.y - last.y);
        return;
      }
      const [a0, b0] = [...pointers.values()];
      pointers.set(event.pointerId, point);
      const [a1, b1] = [...pointers.values()];
      const before = midpoint(a0, b0);
      const after = midpoint(a1, b1);
      panBy(after.x - before.x, after.y - before.y);
      const spread = distance(a0, b0);
      if (spread > 0) zoomBy(distance(a1, b1) / spread, after);
    };

    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) zoomBy(Math.exp(-event.deltaY * 0.01), { x: event.clientX, y: event.clientY });
      else panBy(-event.deltaX, -event.deltaY);
    };

    layer.addEventListener('pointerdown', onDown);
    layer.addEventListener('pointermove', onMove);
    layer.addEventListener('pointerup', onUp);
    layer.addEventListener('pointercancel', onUp);
    layer.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      layer.removeEventListener('pointerdown', onDown);
      layer.removeEventListener('pointermove', onMove);
      layer.removeEventListener('pointerup', onUp);
      layer.removeEventListener('pointercancel', onUp);
      layer.removeEventListener('wheel', onWheel);
    };
  }, [layer, panBy, zoomBy]);
};
