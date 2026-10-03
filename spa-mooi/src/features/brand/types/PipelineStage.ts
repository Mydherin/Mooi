import type { LucideIcon } from 'lucide-react';
import type { ShapeDrawer } from '@/features/brand/types/ShapeDrawer';

export interface PipelineStage {
  id: string;
  label: string;
  /** The line typed under the stage while its shape is on screen. */
  caption: string;
  icon: LucideIcon;
  draw: ShapeDrawer;
  /** Leaving this stage fires every particle upwards before the next shape gathers them. */
  launches?: boolean;
}
