import type { FieldPalette } from '@/features/brand/types/FieldPalette';
import type { Shockwave } from '@/features/brand/types/Shockwave';

const LIFETIME_MS = 900;
const SPEED = 0.42;

/** Draws expanding rings for recent bursts and returns the ones still alive. */
export const drawShockwaves = (
  ctx: CanvasRenderingContext2D,
  waves: Shockwave[],
  palette: FieldPalette,
  now: number,
): Shockwave[] => {
  const alive = waves.filter((wave) => now - wave.born < LIFETIME_MS);
  ctx.strokeStyle = palette.accent;
  for (const wave of alive) {
    const age = now - wave.born;
    const fade = 1 - age / LIFETIME_MS;
    ctx.globalAlpha = fade * 0.7;
    ctx.lineWidth = 1 + fade * 2;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, age * SPEED, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return alive;
};
