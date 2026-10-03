import type { FieldPalette } from '@/features/brand/types/FieldPalette';
import type { Particle } from '@/features/brand/types/Particle';

const TIERS = 3;
/** Streak length per unit of velocity: still particles are dots, fast ones become light trails. */
const STREAK = 1.8;

/**
 * Draws every particle as a streak along its velocity. Particles are batched by color and depth
 * tier, so the whole field costs six strokes per frame regardless of its size.
 */
export const drawParticles = (ctx: CanvasRenderingContext2D, particles: Particle[], palette: FieldPalette) => {
  ctx.lineCap = 'round';
  for (const accent of [false, true]) {
    ctx.strokeStyle = accent ? palette.accent : palette.ink;
    for (let tier = 0; tier < TIERS; tier += 1) {
      ctx.globalAlpha = 0.38 + tier * 0.28;
      ctx.lineWidth = 1.1 + tier * 0.6;
      ctx.beginPath();
      for (const p of particles) {
        if (p.accent !== accent || p.tier !== tier) continue;
        ctx.moveTo(p.x - p.vx * STREAK - 0.01, p.y - p.vy * STREAK);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
};
