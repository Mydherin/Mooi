import { lazy, memo, Suspense } from 'react';
import { CircleAlert } from 'lucide-react';
import { ActivityGroup } from './ActivityGroup';
import { ImageGenerationCard } from './ImageGenerationCard';
import { MessageImageGrid } from './MessageImageGrid';
import { NoticeItem } from './NoticeItem';
import { TurnFooter } from '@/features/sessions/components/chat/TurnFooter';
import { groupTurnBlocks } from '@/features/sessions/lib/groupTurnBlocks';
import type { AgentCapabilities } from '@/features/sessions/types/AgentCapabilities';
import type { TranscriptEntry } from '@/features/sessions/types/TranscriptEntry';
import { LogoMark } from '@/shared/components/LogoMark';
import { formatTime } from '@/shared/utils/formatTime';

const MarkdownContent = lazy(() => import('./MarkdownContent'));

interface ChatMessageItemProps {
  sessionId: string;
  entry: TranscriptEntry;
  providerLabel: string;
  capabilities: AgentCapabilities;
  /** The agent is working on this turn right now (not finished, not waiting on the user). */
  live: boolean;
}

/** Unchanged text keeps its identity while the turn streams, so Markdown is parsed only when it changes. */
const AssistantText = memo(function AssistantText({ text }: { text: string }) {
  return (
    <div className="min-w-0 break-words text-[15px] leading-7 text-ink">
      <Suspense fallback={<span className="whitespace-pre-wrap">{text}</span>}>
        <MarkdownContent text={text} />
      </Suspense>
    </div>
  );
});

/**
 * One transcript row. An `assistant` entry is a whole turn: what the agent tells the user renders as
 * text, and everything it does in between folds into activity blocks, in the order it happened (see
 * `groupTurnBlocks`). While the turn is live, the open block — or a fresh one once the agent has
 * spoken — names what it is doing. Optional blocks are gated on the session's capabilities, never
 * on its provider id: a provider without `thinking` never shows one.
 */
export const ChatMessageItem = memo(function ChatMessageItem({ sessionId, entry, providerLabel, capabilities, live }: ChatMessageItemProps) {
  if (entry.kind === 'error') {
    return (
      <li className="flex animate-fade-up items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm leading-relaxed text-danger">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 flex-1 break-words">{entry.text}</span>
      </li>
    );
  }

  if (entry.kind === 'notice') {
    return <NoticeItem entry={entry} />;
  }

  if (entry.kind === 'user') {
    return (
      <li className="flex animate-fade-up flex-col items-end gap-1.5">
        {entry.images.length > 0 ? <MessageImageGrid sessionId={sessionId} images={entry.images} /> : null}
        {entry.text ? (
          <p className="max-w-[95%] break-words rounded-[18px] rounded-br-[6px] border border-brand/15 bg-brand-soft px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-ink sm:max-w-[85%] sm:px-5 sm:py-3.5">
            {entry.text}
          </p>
        ) : null}
        <span className="font-mono text-[10.5px] text-ink-subtle">{formatTime(entry.at)}</span>
      </li>
    );
  }

  const segments = groupTurnBlocks(entry.blocks, capabilities.thinking);

  return (
    <li className="flex animate-fade-up gap-2 sm:gap-4">
      <LogoMark className="hidden size-7 shrink-0 drop-shadow-[0_2px_6px_rgb(39_110_241/0.25)] sm:block" />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-ink">{providerLabel}</span>
          <span className="font-mono text-[10.5px] text-ink-subtle">{formatTime(entry.at)}</span>
        </p>

        <div className="mt-1.5 flex flex-col gap-3">
          {segments.map((segment, index) => segment.kind === 'text' ? <AssistantText key={segment.key} text={segment.block.text} />
            : segment.kind === 'image' ? <ImageGenerationCard key={segment.key} sessionId={sessionId} step={segment.step} />
              : <ActivityGroup key={segment.key} sessionId={sessionId} blocks={segment.blocks} since={entry.at}
                active={live && index === segments.length - 1} />)}
          {/* Once the agent has spoken, its next step opens a new block before any tool shows up. */}
          {live && segments[segments.length - 1]?.kind !== 'activity' ? (
            <ActivityGroup sessionId={sessionId} blocks={[]} since={entry.at} active />
          ) : null}
        </div>

        {entry.result ? <TurnFooter result={entry.result} showCost={capabilities.cost} /> : null}
      </div>
    </li>
  );
});
