import { ChatUsageIndicators } from './ChatUsageIndicators';
import type { SessionUsage } from '@/features/sessions/types/SessionUsage';
import type { SessionConfiguration } from '@/features/sessions/types/SessionConfiguration';
import type { SessionProvider } from '@/features/sessions/types/SessionProvider';
import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import type { SessionStatus } from '@/features/sessions/types/SessionStatus';
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
  onSend: (text: string) => Promise<boolean>;
  onInterrupt: () => Promise<boolean>;
  onConfigurationChange: (configuration: SessionConfiguration) => void;
}

/** The draft stays mounted while a turn runs so an interruption never loses user input. */
const hints: Partial<Record<SessionStatus, string>> = {
  provisioning: 'Preparing the workspace…',
  failed: 'This session failed and no longer takes messages.',
  closed: 'This session is closed.',
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
  onSend,
  onInterrupt,
  onConfigurationChange,
}: ChatComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');

  const effortOptions = modelOptions.find((option) => option.id === model)?.efforts ?? [];
  const configurationDisabled = deploying || busy || status === 'closed' || status === 'failed' || modelLoading || Boolean(modelError);

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

    if (text.length === 0 || blocked || activeTurn || busy) {
      return;
    }

    if (!await onSend(text)) return;
    setValue((current) => current.trim() === text ? '' : current);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="mx-auto w-full max-w-[60rem] shrink-0 bg-surface px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-6">
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
          placeholder={hint ?? 'Describe the next change…'}
          aria-label="Message the agent"
          className="max-h-[min(12rem,25dvh)] w-full resize-none bg-transparent px-5 pt-4 text-base leading-relaxed text-ink placeholder:text-ink-subtle focus:outline-none disabled:cursor-not-allowed"
        />
        {hint ? <p role="status" className="px-5 pb-2 text-xs text-ink-muted">{hint}</p> : null}

        {activeTurn ? <p className="px-5 pb-2 text-xs text-ink-muted">Model and effort changes apply to your next message.</p> : null}

        <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
          <ChatUsageIndicators usage={usage} loading={status === 'provisioning'} />
          {modelOptions.length > 0 ? (
            <label className="flex min-w-0 items-center gap-1.5 text-xs text-ink-subtle">
              <span className="sr-only">Agent model</span>
              <select
                value={model}
                onChange={(event) => changeModel(event.target.value)}
                disabled={configurationDisabled}
                aria-describedby={modelError ? 'model-error' : undefined}
                className="max-w-[9rem] truncate rounded-lg border border-line bg-surface px-2 py-1.5 font-medium text-ink outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              >
                {!modelOptions.some((option) => option.id === model) ? <option value={model}>{model}</option> : null}
                {modelOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              {modelError ? <span id="model-error" className="sr-only">{modelError}</span> : null}
            </label>
          ) : modelLoading ? (
            <span className="text-xs text-ink-subtle" role="status">Loading models…</span>
          ) : modelError ? (
            <span className="max-w-[16rem] truncate text-xs text-danger" role="alert" title={modelError}>{modelError}</span>
          ) : null}

          {effortOptions.length > 0 ? (
            <label className="flex min-w-0 items-center gap-1.5 text-xs text-ink-subtle">
              <span>Effort</span>
              <select
                value={effort ?? ''}
                onChange={(event) => onConfigurationChange({ model, effort: event.target.value || null })}
                disabled={configurationDisabled}
                aria-label="Agent effort"
                className="max-w-[9rem] truncate rounded-lg border border-line bg-surface px-2 py-1.5 font-medium text-ink outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              >
                {effort && !effortOptions.includes(effort) ? <option value={effort}>{effort}</option> : null}
                {effortOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ) : null}

          {!activeTurn && !blocked ? <span className="ml-auto hidden text-xs text-ink-subtle sm:flex">Enter to send · Shift+Enter for a new line</span> : null}

          {activeTurn ? (
            <Button
              variant="danger"
              onClick={() => void onInterrupt()}
              disabled={busy || !canInterrupt}
              ariaLabel="Stop turn"
              className="ml-auto size-11 shrink-0 p-0"
            >
              <Square className="size-4" />
            </Button>
          ) : !blocked ? (
            <Button
              variant="brand"
              onClick={submit}
              disabled={busy || value.trim().length === 0}
              ariaLabel="Send message"
              className="ml-auto size-11 shrink-0 p-0"
            >
              <ArrowUp className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
