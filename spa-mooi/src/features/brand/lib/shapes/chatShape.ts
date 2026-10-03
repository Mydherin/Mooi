import { SHAPE_ACCENT } from '@/features/brand/lib/shapeInks';
import type { ShapeDrawer } from '@/features/brand/types/ShapeDrawer';

/** A speech bubble with a typing indicator: someone is describing what they want. */
export const drawChat: ShapeDrawer = (ctx) => {
  const [left, top, right, bottom, radius] = [28, 46, 212, 170, 34];
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(left + radius, top);
  ctx.arcTo(right, top, right, bottom, radius);
  ctx.arcTo(right, bottom, left, bottom, radius);
  ctx.lineTo(102, bottom);
  ctx.lineTo(52, 206);
  ctx.lineTo(68, bottom);
  ctx.arcTo(left, bottom, left, top, radius);
  ctx.arcTo(left, top, right, top, radius);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = SHAPE_ACCENT;
  for (const x of [82, 120, 158]) {
    ctx.beginPath();
    ctx.arc(x, 108, 11, 0, Math.PI * 2);
    ctx.fill();
  }
};
