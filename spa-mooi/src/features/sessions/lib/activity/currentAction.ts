import { describeStep, thinkingHeadline } from './describeStep';
import type { ActivityBlock } from './groupTurnBlocks';

/** The live line of a running block: the action in flight (the latest one when tools run in parallel), else the last thought. */
export const currentAction = (blocks: ActivityBlock[]): { label: string; detail: string | null } => {
  const running = [...blocks].reverse().find((block) => block.kind === 'step' && block.step.status === 'running');
  const last = running ?? blocks[blocks.length - 1];
  if (last?.kind === 'step' && last.step.status === 'running') {
    const description = describeStep(last.step);
    return { label: description.verb, detail: description.detail };
  }
  if (last?.kind === 'thinking') return { label: thinkingHeadline(last.text) ?? 'Thinking', detail: null };
  return { label: blocks.length ? 'Working' : 'Thinking', detail: null };
};
