import { SHAPE_ACCENT } from '@/features/brand/lib/shapeInks';
import type { ShapeDrawer } from '@/features/brand/types/ShapeDrawer';

/** A rocket on ignition: the change goes to production. */
export const drawShip: ShapeDrawer = (ctx) => {
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(120, 22);
  ctx.bezierCurveTo(154, 50, 162, 98, 152, 146);
  ctx.lineTo(88, 146);
  ctx.bezierCurveTo(78, 98, 86, 50, 120, 22);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(120, 84, 15, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(88, 108);
  ctx.lineTo(60, 152);
  ctx.lineTo(90, 144);
  ctx.moveTo(152, 108);
  ctx.lineTo(180, 152);
  ctx.lineTo(150, 144);
  ctx.stroke();

  ctx.fillStyle = SHAPE_ACCENT;
  ctx.beginPath();
  ctx.moveTo(98, 158);
  ctx.quadraticCurveTo(120, 226, 142, 158);
  ctx.closePath();
  ctx.fill();
};
