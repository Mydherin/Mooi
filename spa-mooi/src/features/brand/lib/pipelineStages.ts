import { AppWindow, CodeXml, MessageSquare, Rocket, Sparkles } from 'lucide-react';
import { drawChat } from '@/features/brand/lib/shapes/chatShape';
import { drawCode } from '@/features/brand/lib/shapes/codeShape';
import { drawMark } from '@/features/brand/lib/shapes/markShape';
import { drawPreview } from '@/features/brand/lib/shapes/previewShape';
import { drawShip } from '@/features/brand/lib/shapes/shipShape';
import type { PipelineStage } from '@/features/brand/types/PipelineStage';

/** The Mooi loop, told in shapes. The last stage is the brand itself and is not a numbered step. */
export const PIPELINE_STAGES: PipelineStage[] = [
  { id: 'chat', label: 'Chat', caption: '› add yearly plans to the pricing page', icon: MessageSquare, draw: drawChat },
  { id: 'code', label: 'Code', caption: '✓ 6 files changed  +248 −12', icon: CodeXml, draw: drawCode },
  { id: 'preview', label: 'Preview', caption: '● preview live on :5173', icon: AppWindow, draw: drawPreview },
  { id: 'ship', label: 'Ship', caption: '↗ deployed to production', icon: Rocket, draw: drawShip, launches: true },
  { id: 'mooi', label: 'Mooi', caption: '∞ ready for the next idea', icon: Sparkles, draw: drawMark },
];

export const PIPELINE_STEP_COUNT = PIPELINE_STAGES.length - 1;
