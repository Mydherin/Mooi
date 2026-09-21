import { isProviderPlaceholder } from '@/features/sessions/lib/isProviderPlaceholder';
import { lazy, memo, Suspense } from 'react';
import { AgentStepItem } from './AgentStepItem';
import { ThinkingBlock } from './ThinkingBlock';
import type { TranscriptBlock } from '@/features/sessions/types/TranscriptBlock';

const MarkdownContent = lazy(() => import('./MarkdownContent'));

/** Unchanged blocks retain their identity during streaming and skip expensive Markdown parsing. */
export const TranscriptContent = memo(function TranscriptContent({ block }: { block: TranscriptBlock }) {
  if (block.kind === 'step') return <AgentStepItem step={block.step} />;
  if (!block.text.trim() || isProviderPlaceholder(block.text)) return null;
  if (block.kind === 'thinking') return <ThinkingBlock text={block.text} />;
  return (
    <div className="min-w-0 break-words text-[15px] leading-7 text-ink">
      <Suspense fallback={<span className="whitespace-pre-wrap">{block.text}</span>}>
        <MarkdownContent text={block.text} />
      </Suspense>
    </div>
  );
});
