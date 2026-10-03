import { SHAPE_ACCENT } from '@/features/brand/lib/shapeInks';
import type { ShapeDrawer } from '@/features/brand/types/ShapeDrawer';

/** The `</>` glyph: angle brackets in ink, the slash in accent. The agent is writing the code. */
export const drawCode: ShapeDrawer = (ctx) => {
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(80, 62);
  ctx.lineTo(28, 120);
  ctx.lineTo(80, 178);
  ctx.moveTo(160, 62);
  ctx.lineTo(212, 120);
  ctx.lineTo(160, 178);
  ctx.stroke();

  ctx.strokeStyle = SHAPE_ACCENT;
  ctx.beginPath();
  ctx.moveTo(138, 44);
  ctx.lineTo(102, 196);
  ctx.stroke();
};
