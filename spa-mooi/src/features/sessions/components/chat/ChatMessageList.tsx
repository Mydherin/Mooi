import { ChatMessageItem } from '@/features/sessions/components/chat/ChatMessageItem';
import type { ChatMessage } from '@/features/sessions/types/ChatMessage';

interface ChatMessageListProps {
  messages: ChatMessage[];
}

export const ChatMessageList = ({ messages }: ChatMessageListProps) => (
  <ul className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-6 lg:px-6">
    {messages.map((message) => (
      <ChatMessageItem key={message.id} message={message} />
    ))}
  </ul>
);
