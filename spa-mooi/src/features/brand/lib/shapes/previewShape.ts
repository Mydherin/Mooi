import { SHAPE_ACCENT } from '@/features/brand/lib/shapeInks';
import type { ShapeDrawer } from '@/features/brand/types/ShapeDrawer';

const line = (ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, width: number) => {
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
};

/** A browser window with a page and its call to action: the change is running. */
export const drawPreview: ShapeDrawer = (ctx) => {
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.roundRect(24, 38, 192, 164, 22);
  ctx.stroke();
  line(ctx, 24, 76, 216, 6);

  for (const x of [48, 68, 88]) {
    ctx.beginPath();
    ctx.arc(x, 57, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  line(ctx, 50, 106, 152, 11);
  line(ctx, 50, 132, 190, 6);
  line(ctx, 50, 150, 166, 6);

  ctx.fillStyle = SHAPE_ACCENT;
  ctx.beginPath();
  ctx.roundRect(50, 166, 70, 20, 10);
  ctx.fill();
};
