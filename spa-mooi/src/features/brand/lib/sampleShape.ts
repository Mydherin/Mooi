import { SHAPE_BOX, SHAPE_INK } from '@/features/brand/lib/shapeInks';
import type { ShapeDrawer } from '@/features/brand/types/ShapeDrawer';
import type { ShapePoint } from '@/features/brand/types/ShapePoint';

const HALF = SHAPE_BOX / 2;
const JITTER = 1.2 / HALF;

const shuffle = <T,>(items: T[]): T[] => {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

/**
 * Rasterizes a shape offscreen and picks exactly `count` points on it. Points are ordered by angle
 * around the center: since every shape shares that order, a particle travels a short arc between
 * shapes and the whole morph reads as one rotating motion instead of noise.
 */
export const sampleShape = (draw: ShapeDrawer, count: number): ShapePoint[] => {
  const canvas = document.createElement('canvas');
  canvas.width = SHAPE_BOX;
  canvas.height = SHAPE_BOX;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = SHAPE_INK;
  ctx.fillStyle = SHAPE_INK;
  draw(ctx);

  const { data } = ctx.getImageData(0, 0, SHAPE_BOX, SHAPE_BOX);
  const pool: ShapePoint[] = [];
  for (let y = 0; y < SHAPE_BOX; y += 1) {
    for (let x = 0; x < SHAPE_BOX; x += 1) {
      const i = (y * SHAPE_BOX + x) * 4;
      if (data[i + 3] < 128) continue;
      pool.push({ x: (x - HALF) / HALF, y: (y - HALF) / HALF, accent: data[i + 2] > data[i] });
    }
  }
  if (pool.length === 0) return [];

  shuffle(pool);
  const points = Array.from({ length: count }, (_, i) => {
    const point = pool[i % pool.length];
    if (i < pool.length) return point;
    return { ...point, x: point.x + (Math.random() - 0.5) * JITTER, y: point.y + (Math.random() - 0.5) * JITTER };
  });
  return points.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
};
