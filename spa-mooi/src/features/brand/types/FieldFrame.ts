import type { FieldPointer } from '@/features/brand/types/FieldPointer';
import type { ShapePoint } from '@/features/brand/types/ShapePoint';
import type { StageLayout } from '@/features/brand/types/StageLayout';

/** Everything a particle needs to advance one frame. */
export interface FieldFrame {
  now: number;
  /** Elapsed time in 60 fps frames, so physics constants stay frame-rate independent. */
  dt: number;
  stage: number;
  stageStart: number;
  shapes: ShapePoint[][];
  launches: boolean[];
  layout: StageLayout;
  pointer: FieldPointer;
}
