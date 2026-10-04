import { ChatUsageIndicators } from './ChatUsageIndicators';
import type { SessionUsage } from '@/features/sessions/types/SessionUsage';
import type { SessionConfiguration } from '@/features/sessions/types/SessionConfiguration';
import type { SessionProvider } from '@/features/sessions/types/SessionProvider';
import { useLayoutEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { ArrowUp, ImagePlus, RotateCw, Square } from 'lucide-react';
import type { SessionStatus } from '@/features/sessions/types/SessionStatus';
import { DictationButton } from '@/features/dictation/components/DictationButton';
import { useImageDraft } from '@/features/sessions/hooks/useImageDraft';
import { imageFilesFrom } from '@/features/sessions/lib/imageFilesFrom';
import type { PreparedImage } from '@/features/sessions/types/PreparedImage';
import { AttachImageButton } from './AttachImageButton';
import { ComposerImageStrip } from './ComposerImageStrip';
import { ComposerSelect } from './ComposerSelect';
import { Button } from '@/shared/components/Button';
import { cn } from '@/shared/utils/cn';

interface ChatComposerProps {
  status: SessionStatus;
  usage?: SessionUsage;
  busy: boolean;
  deploying?: boolean;
  model: string;
  effort: string | null;
  modelOptions: SessionProvider['models'];
  modelLoading: boolean;
  modelError: string | null;
  canInterrupt: boolean;
  hasConversation: boolean;
  /** The provider takes images; each model may still decline them. */
  acceptsImages?: boolean;
  onSend: (text: string, images: PreparedImage[]) => Promise<boolean>;
  onInterrupt: () => Promise<boolean>;
  /** The session failed with its agent and workspace intact: offer to reconnect it. */
  recoverable?: boolean;
  onRecover: () => Promise<boolean>;
  onCompact: () => Promise<boolean>;
  onClear: () => Promise<boolean>;
  onConfigurationChange: (configuration: SessionConfiguration) => void;
  /** Extra toolbar actions next to the context indicator, e.g. applying a recipe. */
  actions?: ReactNode;
}

/** The draft stays mounted while a turn runs so an interruption never loses user input. */
const hints: Partial<Record<SessionStatus, string>> = {
  provisioning: 'Preparing the workspace…',
  failed: 'This session failed and no longer takes messages.',
  closed: 'This session is closed.',
  compacting: 'Compacting context… Your draft is saved.',
};
const recoverableHint = 'The agent lost its connection. Your draft, workspace and changes are kept.';

export const ChatComposer = ({
  status,
  usage,
  busy,
  deploying = false,
  model,
  effort,
  modelOptions,
  modelLoading,
  modelError,
  canInterrupt,
  hasConversation,
  acceptsImages = false,
  onSend,
  onInterrupt,
  recoverable = false,
  onRecover,
  onCompact,
  onClear,
  onConfigurationChange,
  actions,
}: ChatComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  const [dragging, setDragging] = useState(false);
  const draft = useImageDraft();

  const effortOptions = modelOptions.find((option) => option.id === model)?.efforts ?? [];
  const configurationDisabled = deploying || busy || status === 'closed' || status === 'failed' || status === 'compacting' || modelLoading || Boolean(modelError);

  const changeModel = (nextModel: string) => {
    const option = modelOptions.find((entry) => entry.id === nextModel);
    const supported = option?.efforts ?? [];
    onConfigurationChange({ model: nextModel, effort: effort && supported.includes(effort)
      ? effort : option?.defaultEffort ?? supported[0] ?? null });
  };

  const reconnectable = status === 'failed' && recoverable;
  const hint = (reconnectable ? recoverableHint : hints[status]) ?? (deploying ? 'Deployment in progress. Your draft is saved; chat resumes when it finishes.' : null);
  const blocked = hint !== null;
  const activeTurn = status === 'working' || status === 'waiting';
  const imagesReason = modelOptions.find((option) => option.id === model)?.images === false
    ? 'The selected model does not accept images' : null;
  const canAttach = acceptsImages && !blocked && !draft.full;
  const readyImages = draft.images.filter((image) => image.status === 'ready');
  const hasImages = draft.images.length > 0;
  const sendable = (value.trim().length > 0 || readyImages.length > 0) && !draft.preparing && !(hasImages && imagesReason);
  const imageStatus = draft.notice ?? (hasImages && imagesReason ? `${imagesReason}. Pick another model or remove them.` : null);

  const attach = (files: File[]) => {
    if (acceptsImages && !blocked) draft.add(files);
  };

  const onDragOver = (event: DragEvent) => {
    if (!acceptsImages || blocked || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  };

  const resize = () => {
    const textarea = textareaRef.current;

    if (textarea) {
      // Collapsing to `auto` to measure resets the scroll: keep the reader (or a dictation) where it was.
      const { scrollTop } = textarea;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
      textarea.scrollTop = scrollTop;
    }
  };

  useLayoutEffect(() => {
    resize();
  }, [status, value]);

  const submit = async () => {
    const text = value.trim();

    if (!sendable || blocked || activeTurn || busy || status !== 'ready') {
      return;
    }

    const sent = readyImages;
    if (!await onSend(text, sent.flatMap((image) => image.prepared ? [image.prepared] : []))) return;
    setValue((current) => current.trim() === text ? '' : current);
    draft.discard(sent.map((image) => image.key));

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="mx-auto w-full max-w-[60rem] shrink-0 bg-surface px-2.5 pt-2 pb-[max(0.625rem,var(--safe-bottom))] sm:px-8 sm:pt-3 sm:pb-6">
      <div
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          if (!dragging) return;
          event.preventDefault();
          setDragging(false);
          attach(imageFilesFrom(event.dataTransfer));
        }}
        className={cn('relative rounded-2xl border bg-surface-2 transition focus-within:border-ink',
          dragging ? 'border-brand' : 'border-line')}
      >
        {dragging ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-[inherit] border-2 border-dashed border-brand bg-brand-soft/90 text-sm font-semibold text-brand-strong">
            <ImagePlus className="size-5" />
            Drop images to attach
          </div>
        ) : null}
        {hasImages ? <ComposerImageStrip images={draft.images} onRemove={draft.remove} /> : null}
        <textarea
          ref={textareaRef}
          rows={2}
          value={value}
          disabled={blocked}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          onPaste={(event) => {
            const files = acceptsImages ? imageFilesFrom(event.clipboardData) : [];
            if (files.length === 0) return;
            // A screenshot carries no text: keep the native paste only when there is text to insert.
            if (!event.clipboardData.types.includes('text/plain')) event.preventDefault();
            attach(files);
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter'
              && !event.nativeEvent.isComposing
              && event.nativeEvent.keyCode !== 229
              && !event.shiftKey
              && !event.metaKey
              && !event.ctrlKey
              && !event.altKey
            ) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={hint ? undefined : 'Describe the next change…'}
          aria-label="Message the agent"
          enterKeyHint="send"
          data-compose
          className="max-h-[min(12rem,25dvh)] w-full resize-none bg-transparent px-4 pt-3 text-base leading-relaxed keyboard:max-h-32 sm:px-5 sm:pt-4 text-ink placeholder:text-ink-subtle focus:outline-none disabled:cursor-not-allowed"
        />
        {hint ? <p role="status" className="px-4 pb-2 text-xs text-ink-muted sm:px-5">{hint}</p> : null}
        {imageStatus ? <p role="status" className="px-4 pb-2 text-xs text-warning sm:px-5">{imageStatus}</p> : null}

        {activeTurn ? <p className="px-4 pb-2 text-xs text-ink-muted sm:px-5">Model and effort changes apply to your next message.</p> : null}

        {/* One row at every width: the pickers scroll sideways rather than pushing send to a new line. */}
        <div className="flex items-center gap-1 px-1.5 pb-1.5 sm:gap-2 sm:px-2 sm:pb-2">
          <ChatUsageIndicators usage={usage} loading={status === 'provisioning' || status === 'compacting'}
            actionsDisabled={busy || deploying || status !== 'ready' || !hasConversation}
            onCompact={onCompact} onClear={onClear} />
          {actions}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden">
          {modelOptions.length > 0 ? (
            <>
              <ComposerSelect value={model} options={modelOptions.map((option) => ({ value: option.id, label: option.label }))}
                onChange={changeModel} disabled={configurationDisabled} ariaLabel="Agent model"
                describedBy={modelError ? 'model-error' : undefined} />
              {modelError ? <span id="model-error" className="sr-only">{modelError}</span> : null}
            </>
          ) : modelLoading ? (
            <span className="text-xs text-ink-subtle" role="status">Loading models…</span>
          ) : modelError ? (
            <span className="max-w-[16rem] truncate text-xs text-danger" role="alert" title={modelError}>{modelError}</span>
          ) : null}

          {effortOptions.length > 0 ? (
            <ComposerSelect value={effort ?? ''} options={effortOptions.map((option) => ({ value: option, label: option }))}
              onChange={(value) => onConfigurationChange({ model, effort: value || null })}
              disabled={configurationDisabled} ariaLabel="Agent effort" caption="Effort" />
          ) : null}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
            {!activeTurn && !blocked ? <span className="mr-1 hidden text-xs text-ink-subtle lg:flex">Enter to send · Shift+Enter for a new line</span> : null}

            {acceptsImages && !blocked ? (
              <AttachImageButton onPick={attach} disabled={!canAttach} reason={imagesReason} className="max-sm:size-10" />
            ) : null}

            {!blocked ? <DictationButton field={textareaRef} className="max-sm:size-10" /> : null}

            {activeTurn ? (
              <Button
                variant="danger"
                onClick={() => void onInterrupt()}
                disabled={busy || !canInterrupt}
                ariaLabel="Stop turn"
                className="size-10 shrink-0 p-0 sm:size-11"
              >
                <Square className="size-4" />
              </Button>
            ) : reconnectable ? (
              <Button variant="brand" onClick={() => void onRecover()} disabled={busy} ariaLabel="Reconnect the agent"
                className="h-10 shrink-0 gap-1.5 px-3 sm:h-11 sm:px-4">
                <RotateCw className={cn('size-4', busy && 'animate-spin')} />
                Reconnect
              </Button>
            ) : !blocked ? (
              <Button
                variant="brand"
                onClick={submit}
                disabled={busy || !sendable}
                ariaLabel="Send message"
                className="size-10 shrink-0 p-0 sm:size-11"
              >
                <ArrowUp className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
