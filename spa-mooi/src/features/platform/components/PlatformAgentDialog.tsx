import { useRef, useState, type KeyboardEvent } from 'react';
import { CornerDownLeft, Sparkles } from 'lucide-react';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import type { PlatformAgentCopy } from '@/features/platform/types/PlatformAgentCopy';
import type { PlatformChatRequest } from '@/features/platform/types/PlatformChatRequest';
import { useDictation } from '@/features/dictation/hooks/useDictation';
import { DictationButton } from '@/features/dictation/components/DictationButton';
import { AgentModelFields } from '@/features/sessions/components/AgentModelFields';
import { useAgentModelChoice } from '@/features/sessions/hooks/useAgentModelChoice';
import { Button } from '@/shared/components/actions/Button';
import { Alert } from '@/shared/components/feedback/Alert';
import { fieldControl } from '@/shared/components/forms/fieldStyles';
import { TOUCH_QUERY } from '@/shared/hooks/mediaQueries';
import { Dialog } from '@/shared/components/overlays/dialog/Dialog';
import { cn } from '@/shared/utils/cn';

interface PlatformAgentDialogProps {
  copy: PlatformAgentCopy;
  projectName: string;
  connections: AgentConnection[];
  busy: boolean;
  error: string | null;
  /** The request may be left empty (e.g. fixing a failure the agent reads by itself). */
  optionalPrompt: boolean;
  suggestions?: string[];
  /** Shown when a live chat of this kind exists and will be replaced. */
  replaceNotice?: string | null;
  buildMessage: (prompt: string) => string;
  onClose: () => void;
  onSubmit: (request: PlatformChatRequest) => void;
}

/** Chooses the agent and the request that opens a platform chat; Enter submits (Shift+Enter breaks lines), except on touch screens. */
export const PlatformAgentDialog = ({ copy, projectName, connections, busy, error, optionalPrompt, suggestions = [],
  replaceNotice, buildMessage, onClose, onSubmit }: PlatformAgentDialogProps) => {
  const choice = useAgentModelChoice(true, connections);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const dictation = useDictation(promptRef);
  const [prompt, setPrompt] = useState('');
  const valid = choice.ready && (optionalPrompt || prompt.trim().length > 0);

  const submit = () => {
    if (!valid || busy) return;
    dictation.finish();
    onSubmit({ provider: choice.provider, adapter: choice.adapter || undefined, connectionId: choice.connectionId, model: choice.model,
      effort: choice.effort || null, message: buildMessage(prompt) });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !window.matchMedia(TOUCH_QUERY).matches) {
      event.preventDefault();
      submit();
    }
  };

  return <Dialog open size="lg" onClose={onClose} dismissible={!busy} title={copy.title}
    description={`${projectName} · ${copy.description}`}
    footer={<>
      <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button variant="brand" icon={Sparkles} loading={busy} onClick={submit} disabled={!valid}>{copy.action}</Button>
    </>}>
    <div className="flex flex-col gap-5 sm:gap-6">
      <AgentModelFields choice={choice} onLeave={onClose} />

      {/* On phones the request comes first: it is what the dialog is for, the agent defaults rarely change. */}
      {connections.length > 0 ? <label className="flex flex-col gap-2 max-sm:order-first">
        <span className="text-footnote font-medium text-ink-muted">{copy.label}</span>
        <div className={cn(fieldControl, 'px-0 has-[textarea:focus]:border-brand/60 has-[textarea:focus]:ring-4 has-[textarea:focus]:ring-brand/12')}>
          <textarea ref={promptRef} autoFocus rows={5} value={prompt} disabled={busy} onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={onKeyDown} placeholder={copy.placeholder} maxLength={20000} enterKeyHint="enter"
            className="block min-h-28 w-full resize-y overscroll-contain bg-transparent p-3.5 text-input text-ink placeholder:text-ink-subtle focus:outline-none disabled:opacity-60 sm:min-h-32" />
          <div className="flex items-center justify-between gap-3 border-t border-line py-1.5 pr-1.5 pl-3.5 text-caption text-ink-subtle">
            <span className="inline-flex min-w-0 items-center gap-1.5 touch:invisible"><CornerDownLeft className="size-3.5 shrink-0" /><span className="truncate">Enter to start · Shift+Enter for a new line</span></span>
            <span className="inline-flex items-center gap-2">
              <span className="tabular-nums">{prompt.length > 0 ? prompt.length : ''}</span>
              <DictationButton field={promptRef} dictation={dictation} disabled={busy} className="size-8" />
            </span>
          </div>
        </div>
        {suggestions.length > 0 && prompt.length === 0 ? <div className="flex flex-wrap gap-2 pt-1">
          {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setPrompt(suggestion)}
            className="min-h-11 max-w-full rounded-full border border-line bg-surface px-3.5 py-2 text-left text-footnote font-semibold text-ink-muted transition active:scale-[0.97] hover-device:hover:border-line-strong hover-device:hover:text-ink focus-visible:outline-2 focus-visible:outline-brand">
            {suggestion}
          </button>)}
        </div> : null}
      </label> : null}

      {replaceNotice ? <Alert tone="info">{replaceNotice}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  </Dialog>;
};
