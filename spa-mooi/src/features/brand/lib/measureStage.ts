import type { StageLayout } from '@/features/brand/types/StageLayout';

const MAX_RADIUS = 170;
/** Leaves room for the orbit ring, drawn at 1.34× the shape radius. */
const FILL = 0.7;

/** Shapes are centered on `area`; the canvas may be larger so particles can roam past it. */
export const measureStage = (canvas: HTMLCanvasElement, area: HTMLElement): StageLayout => {
  const bounds = canvas.getBoundingClientRect();
  const stage = area.getBoundingClientRect();
  return {
    width: bounds.width,
    height: bounds.height,
    cx: stage.left - bounds.left + stage.width / 2,
    cy: stage.top - bounds.top + stage.height / 2,
    radius: Math.min(MAX_RADIUS, (Math.min(stage.width, stage.height) / 2) * FILL),
    dpr: Math.min(window.devicePixelRatio || 1, 2),
  };
};
