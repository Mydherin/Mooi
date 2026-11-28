import { useState } from 'react';
import { ChevronDown, Map as MapIcon } from 'lucide-react';
import { FactoryMilestoneRow } from '@/features/factory/components/FactoryMilestoneRow';
import { countMilestones } from '@/features/factory/lib/countMilestones';
import type { FactoryPhase } from '@/features/factory/types/FactoryPhase';
import type { FactoryStep } from '@/features/factory/types/FactoryStep';
import { Badge } from '@/shared/components/data-display/Badge';
import { Card } from '@/shared/components/data-display/Card';
import { Eyebrow } from '@/shared/components/data-display/Eyebrow';
import type { Tone } from '@/shared/types/Tone';
import { cn } from '@/shared/utils/cn';

const PHASE_TONES: Record<FactoryPhase['status'], Tone> = { planned: 'neutral', expanded: 'brand', done: 'success', reopened: 'warning' };
const PHASE_LABELS: Record<FactoryPhase['status'], string> = { planned: 'Planned', expanded: 'In progress', done: 'Done', reopened: 'Reopened' };

interface FactoryRoadmapProps {
  phases: FactoryPhase[];
  activeStep: FactoryStep | null;
}

/** Phases in build order, each folding open into its milestones; finished phases start folded. */
export const FactoryRoadmap = ({ phases, activeStep }: FactoryRoadmapProps) => {
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  return (
    <Card as="section" className="flex flex-col p-4 sm:p-5">
      <Eyebrow>Roadmap</Eyebrow>
      {phases.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-footnote text-ink-subtle"><MapIcon className="size-4" />No phases yet.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {phases.map((phase) => {
            const open = toggled[phase.id] ?? phase.status !== 'done';
            const { done, total } = countMilestones([phase]);
            const active = activeStep?.phaseId === phase.id;
            return (
              <li key={phase.id} className={cn('rounded-control border bg-surface-2/50', active ? 'border-brand/40' : 'border-line')}>
                <button type="button" aria-expanded={open} onClick={() => setToggled((current) => ({ ...current, [phase.id]: !open }))}
                  className="flex w-full min-w-0 items-center gap-2.5 rounded-control px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-brand">
                  <span className="shrink-0 font-mono text-mono text-ink-subtle">{phase.id.slice(0, 2)}</span>
                  <span className="min-w-0 flex-1 truncate text-footnote font-semibold text-ink">{phase.title}</span>
                  {total > 0 ? <span className="shrink-0 text-caption text-ink-subtle tabular-nums">{done}/{total}</span> : null}
                  <Badge tone={PHASE_TONES[phase.status]} className="max-sm:hidden">{PHASE_LABELS[phase.status]}</Badge>
                  <ChevronDown className={cn('size-4 shrink-0 text-ink-subtle transition-transform', open && 'rotate-180')} />
                </button>
                {open ? (
                  phase.milestones.length > 0 ? (
                    <ol className="flex flex-col border-t border-line px-1.5 py-1.5">
                      {phase.milestones.map((milestone) => (
                        <FactoryMilestoneRow key={milestone.id} milestone={milestone}
                          active={active && activeStep?.milestoneId === milestone.id} />
                      ))}
                    </ol>
                  ) : (
                    <p className="border-t border-line px-3 py-2.5 text-footnote text-ink-subtle">
                      Expanded into milestones when its turn comes.
                    </p>
                  )
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
};
