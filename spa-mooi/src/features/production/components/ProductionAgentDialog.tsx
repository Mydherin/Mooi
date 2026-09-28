import { useState, type KeyboardEvent } from 'react';
import { CornerDownLeft, LoaderCircle, Sparkles } from 'lucide-react';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import type { ProductionChatRequest } from '@/features/production/hooks/useProductionChat';
import { productionAgentMessage } from '@/features/production/lib/productionAgentMessage';
import type { ProductionAgentIntent } from '@/features/production/types/ProductionAgentIntent';
import { AgentModelFields } from '@/features/sessions/components/AgentModelFields';
import { useAgentModelChoice } from '@/features/sessions/hooks/useAgentModelChoice';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';

interface ProductionAgentDialogProps {
  intent: ProductionAgentIntent;
  projectName: string;
  connections: AgentConnection[];
  busy: boolean;
  error: string | null;
  /** A live production chat exists and will be replaced. */
  replacesChat: boolean;
  failedRelease?: string | null;
  onClose: () => void;
  onSubmit: (request: ProductionChatRequest) => void;
}

const COPY: Record<ProductionAgentIntent, { title: string; description: string; label: string; placeholder: string; action: string }> = {
  setup: {
    title: 'Deploy to production',
    description: 'Pick the agent and describe how this project should reach production. It prepares DEPLOYMENT.md, deploy.sh and status.sh with you in a chat.',
    label: 'How should it be deployed?',
    placeholder: 'For example: build the Docker image, push it to my registry and restart the service over SSH on my VPS. Serve it behind Caddy at app.example.com…',
    action: 'Start deployment setup',
  },
  update: {
    title: 'Change deployment settings',
    description: 'Describe what should change. The agent updates the deployment files; the new version goes live with the next successful deployment.',
    label: 'What should change?',
    placeholder: 'For example: move to a new host, add a database migration step, check /health instead of /…',
    action: 'Start update',
  },
  fix: {
    title: 'Fix the deployment',
    description: 'The agent reads the failed attempt, explains the cause and corrects the configuration with you.',
    label: 'Anything the agent should know? (optional)',
    placeholder: 'For example: the server was rebuilt yesterday, the SSH user changed…',
    action: 'Start fixing',
  },
};

const SUGGESTIONS = [
  'Docker Compose on my server over SSH',
  'Static build published to GitHub Pages',
  'Container image deployed to Fly.io',
];

/** Chooses the agent and the request that opens a production chat; Enter submits, Shift+Enter breaks lines. */
export const ProductionAgentDialog = ({ intent, projectName, connections, busy, error, replacesChat, failedRelease, onClose, onSubmit }: ProductionAgentDialogProps) => {
  const choice = useAgentModelChoice(true, connections);
  const [prompt, setPrompt] = useState('');
  const copy = COPY[intent];
  const valid = choice.ready && (intent === 'fix' || prompt.trim().length > 0);

  const submit = () => {
    if (!valid || busy) return;
    onSubmit({ provider: choice.provider, connectionId: choice.connectionId, model: choice.model,
      effort: choice.effort || null, message: productionAgentMessage(intent, prompt, failedRelease) });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return <Modal open size="lg" onClose={busy ? () => undefined : onClose} title={copy.title}
    description={`${projectName} · ${copy.description}`}
    footer={<>
      <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button variant="brand" onClick={submit} disabled={!valid || busy}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {busy ? 'Starting…' : copy.action}
      </Button>
    </>}>
    <div className="flex flex-col gap-6">
      <AgentModelFields choice={choice} onLeave={onClose} />

      {connections.length > 0 ? <label className="flex flex-col gap-2">
        <span className="text-xs font-medium text-ink-muted">{copy.label}</span>
        <div className="rounded-[12px] border border-line bg-surface-2 transition focus-within:border-brand/50">
          <textarea autoFocus rows={5} value={prompt} disabled={busy} onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={onKeyDown} placeholder={copy.placeholder} maxLength={20000}
            className="block min-h-32 w-full resize-y bg-transparent p-3.5 text-sm leading-6 text-ink placeholder:text-ink-subtle focus:outline-none disabled:opacity-60" />
          <div className="flex items-center justify-between gap-3 border-t border-line px-3.5 py-2 text-[11px] text-ink-subtle">
            <span className="inline-flex items-center gap-1.5"><CornerDownLeft className="size-3.5" />Enter to start · Shift+Enter for a new line</span>
            <span className="tabular-nums">{prompt.length > 0 ? prompt.length : ''}</span>
          </div>
        </div>
        {intent === 'setup' && prompt.length === 0 ? <div className="flex flex-wrap gap-2 pt-1">
          {SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => setPrompt(suggestion)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-brand">
            {suggestion}
          </button>)}
        </div> : null}
      </label> : null}

      {replacesChat ? <p className="rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-xs leading-relaxed text-ink-muted">
        This starts a new deployment chat and closes the current one. The saved configuration is kept.
      </p> : null}
      {error ? <p role="alert" className="rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">{error}</p> : null}
    </div>
  </Modal>;
};
