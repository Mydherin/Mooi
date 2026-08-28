import { ChatComposer } from '@/features/sessions/components/chat/ChatComposer';
import { ChatMessageList } from '@/features/sessions/components/chat/ChatMessageList';
import type { ChatMessage } from '@/features/sessions/types/ChatMessage';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

export const ChatPanel = ({ messages, onSend }: ChatPanelProps) => (
  <div className="flex h-full min-h-0 flex-col">
    <ChatMessageList messages={messages} />
    <ChatComposer onSend={onSend} />
  </div>
);
