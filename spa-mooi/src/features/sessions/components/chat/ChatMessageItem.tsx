import { AgentStepList } from '@/features/sessions/components/chat/AgentStepList';
import { ThinkingIndicator } from '@/features/sessions/components/chat/ThinkingIndicator';
import type { ChatMessage } from '@/features/sessions/types/ChatMessage';
import { Avatar } from '@/shared/components/Avatar';
import { LogoMark } from '@/shared/components/LogoMark';

interface ChatMessageItemProps {
  message: ChatMessage;
}

export const ChatMessageItem = ({ message }: ChatMessageItemProps) => {
  if (message.role === 'system') {
    return (
      <li className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-ink-subtle">
        {message.text}
      </li>
    );
  }

  const isRunning = message.steps?.some((step) => step.status === 'running') ?? false;

  return (
    <li className="flex gap-3">
      {message.role === 'user' ? (
        <Avatar src={null} name={message.author} size="sm" />
      ) : (
        <LogoMark className="size-8 shrink-0 rounded-lg" />
      )}

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{message.author}</span>
          <span className="text-xs text-ink-subtle">{message.time}</span>
        </p>

        {message.role === 'user' ? (
          <p className="mt-2 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink">
            {message.text}
          </p>
        ) : (
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{message.text}</p>
        )}

        {message.steps ? <AgentStepList steps={message.steps} /> : null}
        {isRunning ? (
          <div className="mt-2">
            <ThinkingIndicator />
          </div>
        ) : null}
      </div>
    </li>
  );
};
