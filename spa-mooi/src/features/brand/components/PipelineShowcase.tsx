import { PipelineSteps } from '@/features/brand/components/PipelineSteps';
import { StageCaption } from '@/features/brand/components/StageCaption';
import { usePipelineAnimation } from '@/features/brand/hooks/usePipelineAnimation';
import { PIPELINE_STAGES, PIPELINE_STEP_COUNT } from '@/features/brand/lib/pipelineStages';
import { cn } from '@/shared/utils/cn';

interface PipelineShowcaseProps {
  className?: string;
}

const STEPS = PIPELINE_STAGES.slice(0, PIPELINE_STEP_COUNT);

/**
 * The Mooi loop as a living particle field: chat → code → preview → ship → the mark, and again.
 * The canvas fills the nearest positioned ancestor (not this block) so particles can roam the whole
 * panel; siblings meant to stay above it need `relative z-10`. Click the stage to send a shockwave.
 */
export const PipelineShowcase = ({ className }: PipelineShowcaseProps) => {
  const { canvasRef, areaRef, cursor, goTo, burst } = usePipelineAnimation(PIPELINE_STAGES);

  return (
    <div className={cn('flex flex-col', className)}>
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 size-full text-contrast-ink" />
      <div ref={areaRef} aria-hidden onPointerDown={burst} className="relative z-10 min-h-60 flex-1 cursor-crosshair" />
      <PipelineSteps steps={STEPS} cursor={cursor} onSelect={goTo} />
      <StageCaption key={cursor.cycle} text={PIPELINE_STAGES[cursor.stage].caption} />
    </div>
  );
};
