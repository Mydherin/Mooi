import type { DustMote } from '@/features/brand/types/DustMote';
import type { FieldPalette } from '@/features/brand/types/FieldPalette';
import type { FieldPointer } from '@/features/brand/types/FieldPointer';
import type { StageLayout } from '@/features/brand/types/StageLayout';

const PARALLAX = 0.05;

export const createDust = (count: number): DustMote[] =>
  Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.00012,
    vy: -Math.random() * 0.00018 - 0.00004,
    size: 0.6 + Math.random() * 1.2,
    depth: Math.random(),
  }));

/** Slow background drift that wraps around the canvas, shifted by the pointer for depth. */
export const drawDust = (
  ctx: CanvasRenderingContext2D,
  dust: DustMote[],
  layout: StageLayout,
  pointer: FieldPointer,
  palette: FieldPalette,
  dt: number,
) => {
  const offsetX = pointer.active ? (pointer.x - layout.cx) * PARALLAX : 0;
  const offsetY = pointer.active ? (pointer.y - layout.cy) * PARALLAX : 0;
  ctx.fillStyle = palette.ink;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  for (const mote of dust) {
    mote.x = (mote.x + mote.vx * dt + 1) % 1;
    mote.y = (mote.y + mote.vy * dt + 1) % 1;
    const x = mote.x * layout.width - offsetX * mote.depth;
    const y = mote.y * layout.height - offsetY * mote.depth;
    ctx.rect(x, y, mote.size, mote.size);
  }
  ctx.fill();
  ctx.globalAlpha = 1;
};
