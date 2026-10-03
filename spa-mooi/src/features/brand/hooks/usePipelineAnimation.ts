import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { measureStage } from '@/features/brand/lib/measureStage';
import { ParticleField } from '@/features/brand/lib/ParticleField';
import type { PipelineCursor } from '@/features/brand/types/PipelineCursor';
import type { PipelineStage } from '@/features/brand/types/PipelineStage';

/**
 * Mounts a `ParticleField` on a canvas, centered on an area element, and wires it to the page:
 * size, theme, visibility (the loop sleeps while the canvas is hidden) and the pointer.
 */
export const usePipelineAnimation = (stages: PipelineStage[]) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<ParticleField | null>(null);
  const [cursor, setCursor] = useState<PipelineCursor>({ stage: 0, cycle: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const area = areaRef.current;
    if (!canvas || !area) return undefined;

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const field = new ParticleField(canvas, stages, (stage) => setCursor((current) => ({ stage, cycle: current.cycle + 1 })), still);
    fieldRef.current = field;

    const measure = () => field.resize(measureStage(canvas, area));
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(canvas);
    resizeObserver.observe(area);

    const themeObserver = new MutationObserver(() => field.refreshPalette());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const visibilityObserver = new IntersectionObserver(([entry]) => field.setVisible(entry.isIntersecting));
    visibilityObserver.observe(canvas);

    const onMove = (event: globalThis.PointerEvent) => field.point(event.clientX, event.clientY);
    const onLeave = () => field.release();
    window.addEventListener('pointermove', onMove);
    document.documentElement.addEventListener('pointerleave', onLeave);

    measure();
    field.start();

    return () => {
      field.stop();
      fieldRef.current = null;
      resizeObserver.disconnect();
      themeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [stages]);

  const goTo = useCallback((stage: number) => fieldRef.current?.goTo(stage), []);
  const burst = useCallback((event: PointerEvent) => fieldRef.current?.burst(event.clientX, event.clientY), []);

  return { canvasRef, areaRef, cursor, goTo, burst };
};
