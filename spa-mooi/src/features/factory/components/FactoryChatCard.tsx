import { Link } from 'react-router-dom';
import { MessagesSquare, RotateCcw, SquareArrowOutUpRight } from 'lucide-react';
import { sessionPath } from '@/app/paths';
import { PlatformChatPanel } from '@/features/platform/components/PlatformChatPanel';
import type { Session } from '@/features/sessions/types/Session';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { buttonStyles } from '@/shared/styles/buttonStyles';

interface FactoryChatCardProps {
  projectId: string;
  title: string;
  /** The live factory chat, if any. */
  chat: Session | undefined;
  onOpenChat: () => void;
  /** Sizing classes: the card fills the height it is given. */
  className: string;
}

/** The project's factory chat: the architect while defining, then the place to steer the running factory. */
export const FactoryChatCard = ({ projectId, title, chat, onOpenChat, className }: FactoryChatCardProps) => (
  <Card className={`flex flex-col overflow-hidden ${className}`}>
    <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
      <MessagesSquare className="size-4 shrink-0 text-ink-subtle" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{title}</span>
      {chat ? (
        <Link to={sessionPath(projectId, chat.id)} className={buttonStyles('ghost', 'sm', 'h-8 px-2.5')}
          title="Open as a session, with its changes and trace">
          <SquareArrowOutUpRight className="size-3.5" /><span className="max-sm:sr-only">Open</span>
        </Link>
      ) : null}
      <Button variant="ghost" size="sm" className="h-8 px-2.5" onClick={onOpenChat}>
        <RotateCcw className="size-3.5" /><span className="max-sm:sr-only">{chat ? 'New chat' : 'Open chat'}</span>
      </Button>
    </div>
    <div className="min-h-0 flex-1">
      {chat ? <PlatformChatPanel key={chat.id} sessionId={chat.id} loadingLabel="Opening the factory chat…" completion={null} />
        : <div className="flex h-full items-center justify-center p-4">
          <EmptyState icon={MessagesSquare} title="No chat open"
            description="Open the factory chat to define the project with the architect, or to discuss the approved definition.">
            <Button variant="brand" onClick={onOpenChat}>Open chat</Button>
          </EmptyState>
        </div>}
    </div>
  </Card>
);
