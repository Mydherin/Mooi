import type { FieldPalette } from '@/features/brand/types/FieldPalette';
import type { StageLayout } from '@/features/brand/types/StageLayout';

const TICKS = 72;
const TAU = Math.PI * 2;

/**
 * The instrument ring around the stage: a faint orbit, a slowly turning dial and a comet that
 * travels the orbit once per stage, so the loop's timing is visible without a single number.
 */
export const drawOrbit = (
  ctx: CanvasRenderingContext2D,
  layout: StageLayout,
  palette: FieldPalette,
  progress: number,
  now: number,
) => {
  const radius = layout.radius * 1.34;
  ctx.save();
  ctx.translate(layout.cx, layout.cy);

  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.stroke();

  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  const turn = now * 0.00004;
  for (let i = 0; i < TICKS; i += 1) {
    const angle = (i / TICKS) * TAU + turn;
    const length = i % 6 === 0 ? 8 : 3;
    ctx.moveTo(Math.cos(angle) * (radius + 6), Math.sin(angle) * (radius + 6));
    ctx.lineTo(Math.cos(angle) * (radius + 6 + length), Math.sin(angle) * (radius + 6 + length));
  }
  ctx.stroke();

  const head = -Math.PI / 2 + progress * TAU;
  ctx.strokeStyle = palette.accent;
  ctx.fillStyle = palette.accent;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(0, 0, radius, -Math.PI / 2, head);
  ctx.stroke();

  const x = Math.cos(head) * radius;
  const y = Math.sin(head) * radius;
  ctx.beginPath();
  ctx.arc(x, y, 3.2, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, TAU);
  ctx.fill();

  ctx.restore();
};
