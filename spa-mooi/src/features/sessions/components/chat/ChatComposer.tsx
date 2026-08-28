import { useRef, useState } from 'react';
import { ArrowUp, Paperclip } from 'lucide-react';
import { AgentProviderPicker } from '@/features/sessions/components/chat/AgentProviderPicker';
import { agentProviders } from '@/features/sessions/data/agentProviders';
import { Button } from '@/shared/components/Button';
import { IconButton } from '@/shared/components/IconButton';

interface ChatComposerProps {
  onSend: (text: string) => void;
}

export const ChatComposer = ({ onSend }: ChatComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  const [provider, setProvider] = useState(agentProviders[0].id);

  const resize = () => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  const submit = () => {
    const text = value.trim();

    if (text.length === 0) {
      return;
    }

    onSend(text);
    setValue('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="shrink-0 border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:p-4">
      <div className="rounded-2xl border border-line bg-surface-2 transition focus-within:border-brand/50">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            resize();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Describe the next change…"
          aria-label="Message the agent"
          className="max-h-40 w-full resize-none bg-transparent px-4 pt-3 text-sm leading-relaxed text-ink placeholder:text-ink-subtle focus:outline-none"
        />

        <div className="flex items-center gap-2 px-2 pb-2">
          <AgentProviderPicker value={provider} onChange={setProvider} />
          <IconButton icon={Paperclip} label="Attach a file" className="size-8" />

          <span className="ml-auto hidden text-xs text-ink-subtle sm:flex">⌘ + ↵</span>

          <Button
            variant="brand"
            onClick={submit}
            disabled={value.trim().length === 0}
            ariaLabel="Send message"
            className="size-9 p-0"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
