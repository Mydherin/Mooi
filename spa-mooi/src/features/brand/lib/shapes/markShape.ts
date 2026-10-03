import { SHAPE_ACCENT } from '@/features/brand/lib/shapeInks';
import type { ShapeDrawer } from '@/features/brand/types/ShapeDrawer';

/** Mirrors `LogoMark` (64×64 viewBox) scaled into the 240 box: the loop ends where the brand begins. */
export const drawMark: ShapeDrawer = (ctx) => {
  ctx.scale(3.75, 3.75);
  ctx.lineWidth = 4.6;
  ctx.stroke(new Path2D('M23.5 40.6A13 13 0 1 0 16.4 33.9L14.5 44.5Z'));

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(43, 42, 12.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = SHAPE_ACCENT;
  ctx.beginPath();
  ctx.arc(43, 42, 9.5, 0, Math.PI * 2);
  ctx.fill();
};
