import { ChatUsageIndicators } from './ChatUsageIndicators';
import type { SessionUsage } from '@/features/sessions/types/SessionUsage';
import type { SessionConfiguration } from '@/features/sessions/types/SessionConfiguration';
import type { SessionProvider } from '@/features/sessions/types/SessionProvider';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import type { SessionStatus } from '@/features/sessions/types/SessionStatus';
import { DictationButton } from '@/features/dictation/components/DictationButton';
import { ComposerSelect } from './ComposerSelect';
import { Button } from '@/shared/components/Button';

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
  onSend: (text: string) => Promise<boolean>;
  onInterrupt: () => Promise<boolean>;
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
  onSend,
  onInterrupt,
  onCompact,
  onClear,
  onConfigurationChange,
  actions,
}: ChatComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');

  const effortOptions = modelOptions.find((option) => option.id === model)?.efforts ?? [];
  const configurationDisabled = deploying || busy || status === 'closed' || status === 'failed' || status === 'compacting' || modelLoading || Boolean(modelError);

  const changeModel = (nextModel: string) => {
    const option = modelOptions.find((entry) => entry.id === nextModel);
    const supported = option?.efforts ?? [];
    onConfigurationChange({ model: nextModel, effort: effort && supported.includes(effort)
      ? effort : option?.defaultEffort ?? supported[0] ?? null });
  };

  const hint = hints[status] ?? (deploying ? 'Deployment in progress. Your draft is saved; chat resumes when it finishes.' : null);
  const blocked = hint !== null;
  const activeTurn = status === 'working' || status === 'waiting';

  const resize = () => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useLayoutEffect(() => {
    resize();
  }, [status, value]);

  const submit = async () => {
    const text = value.trim();

    if (text.length === 0 || blocked || activeTurn || busy || status !== 'ready') {
      return;
    }

    if (!await onSend(text)) return;
    setValue((current) => current.trim() === text ? '' : current);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="mx-auto w-full max-w-[60rem] shrink-0 bg-surface px-2.5 pt-2 pb-[max(0.625rem,var(--safe-bottom))] sm:px-8 sm:pt-3 sm:pb-6">
      <div className="rounded-2xl border border-line bg-surface-2 transition focus-within:border-ink">
        <textarea
          ref={textareaRef}
          rows={2}
          value={value}
          disabled={blocked}
          onChange={(event) => {
            setValue(event.target.value);
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
            ) : !blocked ? (
              <Button
                variant="brand"
                onClick={submit}
                disabled={busy || value.trim().length === 0}
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
