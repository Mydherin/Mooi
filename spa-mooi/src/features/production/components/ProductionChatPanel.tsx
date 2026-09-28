import { LoaderCircle, Rocket } from 'lucide-react';
import { ChatPanel } from '@/features/sessions/components/chat/ChatPanel';
import { useSession } from '@/features/sessions/hooks/useSession';
import { useSessionStream } from '@/features/sessions/hooks/useSessionStream';
import { Button } from '@/shared/components/Button';
import { useSessionsStore } from '@/stores/sessionsStore';

interface ProductionChatPanelProps {
  sessionId: string;
  /** The configuration is saved, every required variable is set and nothing is running. */
  deployable: boolean;
  onDeploy: () => void;
}

/** The production chat: the regular session chat plus a deploy prompt once the configuration is ready. */
export const ProductionChatPanel = ({ sessionId, deployable, onDeploy }: ProductionChatPanelProps) => {
  const chat = useSession(sessionId);
  useSessionStream(sessionId);
  const transcript = useSessionsStore((state) => state.byId[sessionId]);
  const session = chat.session;

  if (!session) {
    return <p className="flex h-full items-center justify-center gap-2 text-sm text-ink-muted">
      <LoaderCircle className="size-4 animate-spin" />Opening the deployment chat…</p>;
  }

  const idle = session.status === 'ready' && !session.pending;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {deployable && idle ? <div role="status" className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-success-soft/60 px-4 py-2.5 sm:px-5">
        <p className="text-sm font-bold text-ink">The configuration is ready. <span className="font-medium text-ink-muted">Deploy whenever you want.</span></p>
        <Button variant="brand" size="sm" onClick={onDeploy}><Rocket className="size-4" />Deploy</Button>
      </div> : null}
      <div className="min-h-0 flex-1">
        <ChatPanel
          session={session}
          entries={transcript?.entries ?? []}
          pending={transcript?.pending ?? []}
          streamState={transcript?.streamState ?? 'closed'}
          busy={chat.busy}
          modelOptions={chat.modelOptions}
          modelLoading={chat.modelLoading}
          modelError={chat.modelError}
          actionError={chat.actionError}
          onSend={chat.send}
          onInterrupt={chat.interrupt}
          onCompact={chat.compact}
          onClear={chat.clearConversation}
          onConfigurationChange={(configuration) => void chat.updateConfiguration(configuration)}
          onAllowPermission={(requestId, updatedInput) => void chat.allowPermission(requestId, updatedInput)}
          onDenyPermission={(requestId, message) => void chat.denyPermission(requestId, message)}
          onAnswerQuestion={(requestId, answers) => void chat.answer(requestId, answers)}
        />
      </div>
    </div>
  );
};
