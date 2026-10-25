import { memo } from 'react';
import { CircleAlert } from 'lucide-react';
import { MessageImageGrid } from './MessageImageGrid';
import { NoticeItem } from './NoticeItem';
import { TranscriptContent } from './TranscriptContent';
import { ThinkingIndicator } from '@/features/sessions/components/chat/ThinkingIndicator';
import { TurnFooter } from '@/features/sessions/components/chat/TurnFooter';
import type { AgentCapabilities } from '@/features/sessions/types/AgentCapabilities';
import type { TranscriptEntry } from '@/features/sessions/types/TranscriptEntry';
import { LogoMark } from '@/shared/components/LogoMark';
import { formatTime } from '@/shared/utils/formatTime';

interface ChatMessageItemProps {
  sessionId: string;
  entry: TranscriptEntry;
  providerLabel: string;
  capabilities: AgentCapabilities;
  working: boolean;
}

/**
 * One transcript row. An `assistant` entry is a whole turn, so its blocks — text, thinking and tool
 * steps — render in the order they actually happened rather than as text with a step list bolted
 * underneath. Optional blocks are gated on the session's capabilities, never on its provider id:
 * a provider without `thinking` never produces one, and one declaring the bare
 * minimum still renders correctly.
 */
export const ChatMessageItem = memo(function ChatMessageItem({ sessionId, entry, providerLabel, capabilities, working }: ChatMessageItemProps) {
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

  return (
    <li className="flex animate-fade-up gap-2 sm:gap-4">
      <LogoMark className="hidden size-7 shrink-0 drop-shadow-[0_2px_6px_rgb(39_110_241/0.25)] sm:block" />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-ink">{providerLabel}</span>
          <span className="font-mono text-[10.5px] text-ink-subtle">{formatTime(entry.at)}</span>
        </p>

        <div className="mt-1.5 flex flex-col gap-2">
          {entry.blocks.map((block) => block.kind === 'thinking' && !capabilities.thinking ? null : (
            <TranscriptContent key={block.kind === 'step' ? `step-${block.step.toolUseId}` : `${block.kind}-${block.id}`} sessionId={sessionId} block={block} />
          ))}
        </div>

        {entry.streaming && working ? (
          <div className="mt-2">
            <ThinkingIndicator />
          </div>
        ) : null}

        {entry.result ? <TurnFooter result={entry.result} showCost={capabilities.cost} /> : null}
      </div>
    </li>
  );
});
