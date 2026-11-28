import { describeStep, type StepKind } from './describeStep';
import type { ActivityBlock } from './groupTurnBlocks';

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** "Explored 3 files, 2 searches · Edited 1 file · Ran 2 commands": what a finished block did. */
export const summarizeActivity = (blocks: ActivityBlock[]): { text: string; failed: number } => {
  const files = { read: new Set<string>(), edit: new Set<string>() };
  const counts: Partial<Record<StepKind, number>> = {};
  let thoughts = 0;
  let failed = 0;

  for (const block of blocks) {
    if (block.kind === 'thinking') {
      thoughts += 1;
      continue;
    }
    const description = describeStep(block.step);
    if (block.step.status === 'failed') failed += 1;
    if ((description.kind === 'read' || description.kind === 'edit') && description.target) {
      files[description.kind].add(description.target);
    } else {
      counts[description.kind] = (counts[description.kind] ?? 0) + 1;
    }
  }

  const reads = files.read.size + (counts.read ?? 0);
  const explored = [
    reads ? plural(reads, 'file') : null,
    counts.search ? plural(counts.search, 'search', 'searches') : null,
    counts.list ? plural(counts.list, 'list') : null,
  ].filter(Boolean);
  const edits = files.edit.size + (counts.edit ?? 0);
  const parts = [
    explored.length ? `Explored ${explored.join(', ')}` : null,
    edits ? `Edited ${plural(edits, 'file')}` : null,
    counts.command ? `Ran ${plural(counts.command, 'command')}` : null,
    counts.web ? `Searched the web${counts.web > 1 ? ` ${counts.web}×` : ''}` : null,
    counts.agent ? `Delegated ${plural(counts.agent, 'task')}` : null,
    counts.plan ? 'Updated plan' : null,
    counts.image ? `Viewed ${plural(counts.image, 'image')}` : null,
    counts.tool ? `Used ${plural(counts.tool, 'tool')}` : null,
  ].filter(Boolean);

  return { text: parts.length ? parts.join(' · ') : thoughts ? 'Thought' : 'Worked', failed };
};
