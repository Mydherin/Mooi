import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DESKTOP_PREVIEW, PREVIEW_MAX_SCALE } from '@/features/sessions/lib/previewViewports';
import type { PreviewZoom } from '@/features/sessions/types/PreviewZoom';

interface Point {
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Scale of the 1920×1080 desktop preview inside its scrolling viewport: "fit" follows the panel
 * size until the user zooms; zoom ranges from fit to `PREVIEW_MAX_SCALE`, and panning is the
 * viewport's own scroll position.
 */
export const usePreviewZoom = (): PreviewZoom => {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const [fitScale, setFitScale] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const maxScale = Math.max(PREVIEW_MAX_SCALE, fitScale);
  const scale = zoom === null ? fitScale : clamp(zoom, fitScale, maxScale);
  const target = useRef(scale);
  // Content point (unscaled px) that must stay under the client point once the new scale renders.
  const anchor = useRef<{ client: Point; content: Point } | null>(null);

  useEffect(() => {
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setFitScale(width && height ? Math.min(width / DESKTOP_PREVIEW.width, height / DESKTOP_PREVIEW.height) : 0);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [viewport]);

  useLayoutEffect(() => {
    target.current = scale;
    const pending = anchor.current;
    anchor.current = null;
    if (!pending || !viewport || !content) return;
    const rect = content.getBoundingClientRect();
    viewport.scrollLeft += rect.left + pending.content.x * scale - pending.client.x;
    viewport.scrollTop += rect.top + pending.content.y * scale - pending.client.y;
  }, [scale, viewport, content]);

  const zoomBy = useCallback((factor: number, point?: Point) => {
    if (!viewport || !content || !fitScale) return;
    const current = target.current;
    const next = clamp(current * factor, fitScale, maxScale);
    if (Math.abs(next - current) < 1e-4) return;
    if (!anchor.current) {
      const bounds = viewport.getBoundingClientRect();
      const client = point ?? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      const rect = content.getBoundingClientRect();
      anchor.current = { client, content: { x: (client.x - rect.left) / current, y: (client.y - rect.top) / current } };
    }
    target.current = next;
    setZoom(next);
  }, [content, fitScale, maxScale, viewport]);

  const panBy = useCallback((dx: number, dy: number) => {
    if (!viewport) return;
    viewport.scrollLeft -= dx;
    viewport.scrollTop -= dy;
  }, [viewport]);

  const fit = useCallback(() => setZoom(null), []);

  return { setViewport, setContent, scale, zoomBy, panBy, fit };
};
