import type { SessionConfiguration } from '@/features/sessions/types/SessionConfiguration';
import type { SessionProvider } from '@/features/sessions/types/SessionProvider';
import { CircleAlert, LoaderCircle } from 'lucide-react';
import { ChatComposer } from '@/features/sessions/components/chat/ChatComposer';
import { ChatMessageList } from '@/features/sessions/components/chat/ChatMessageList';
import type { SessionStreamState } from '@/features/sessions/lib/openSessionStream';
import type { Session } from '@/features/sessions/types/Session';
import type { SessionPendingRequest } from '@/features/sessions/types/SessionPendingRequest';
import type { TranscriptEntry } from '@/features/sessions/types/TranscriptEntry';

interface ChatPanelProps {
  session: Session;
  entries: TranscriptEntry[];
  pending: SessionPendingRequest[];
  streamState: SessionStreamState;
  busy: boolean;
  modelOptions: SessionProvider['models'];
  modelLoading: boolean;
  modelError: string | null;
  actionError: string | null;
  onSend: (text: string) => Promise<boolean>;
  onInterrupt: () => Promise<boolean>;
  onConfigurationChange: (configuration: SessionConfiguration) => void;
  onAllowPermission: (requestId: string, updatedInput?: Record<string, unknown>) => void;
  onDenyPermission: (requestId: string, message?: string) => void;
  onAnswerQuestion: (requestId: string, answers: Record<string, string | string[]>) => void;
}

/**
 * The chat side of the workspace: the transcript, whatever the agent is blocked on, and the
 * composer. Everything it renders comes from the session's own capabilities and status, so a
 * provider that declares the bare minimum still gets a coherent screen.
 */
export const ChatPanel = ({
  session,
  entries,
  pending,
  streamState,
  busy,
  modelOptions,
  modelLoading,
  modelError,
  actionError,
  onSend,
  onInterrupt,
  onConfigurationChange,
  onAllowPermission,
  onDenyPermission,
  onAnswerQuestion,
}: ChatPanelProps) => (
  <div className="flex h-full min-h-0 flex-col">
    {streamState === 'reconnecting' ? (
      <p className="flex shrink-0 items-center gap-2 border-b border-line bg-warning-soft px-4 py-2 text-xs text-warning">
        <LoaderCircle className="size-3.5 animate-spin" />
        Reconnecting to the session stream…
      </p>
    ) : null}

    <p className="shrink-0 truncate px-4 pt-3 text-center text-xs text-ink-subtle">{session.providerLabel} · {session.model}{session.effort ? ` · ${session.effort} effort` : ''}</p>
    {session.detail && session.status !== 'failed' && session.status !== 'closed' ? <p role="status" className="max-h-[20%] shrink-0 overflow-y-auto px-4 py-2 text-sm text-ink-muted [overflow-wrap:anywhere]">{session.detail}</p> : null}
    <ChatMessageList
      key={`transcript-${session.id}`}
      entries={entries}
      pending={pending}
      providerLabel={session.providerLabel}
      capabilities={session.capabilities}
      working={session.status === 'working' || session.status === 'waiting'}
      loading={streamState === 'reconnecting' && entries.length === 0}
      busy={busy}
      editableToolInput={session.capabilities.editableToolInput}
      onAllowPermission={onAllowPermission}
      onDenyPermission={onDenyPermission}
      onAnswerQuestion={onAnswerQuestion}
    />

    {actionError ? (
      <p role="alert" className="flex max-h-[25%] shrink-0 items-start gap-2 overflow-y-auto border-t border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger [overflow-wrap:anywhere] lg:px-6">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        {actionError}
      </p>
    ) : null}

    <ChatComposer
      key={`composer-${session.id}`}
      status={session.status}
      busy={busy}
      model={session.model}
      effort={session.effort ?? null}
      modelOptions={modelOptions}
      modelLoading={modelLoading}
      modelError={modelError}
      canInterrupt={session.capabilities.interrupt}
      onSend={onSend}
      onInterrupt={onInterrupt}
      onConfigurationChange={onConfigurationChange}
    />
  </div>
);
